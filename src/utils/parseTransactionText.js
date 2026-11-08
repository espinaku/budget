// 한 줄 자연어 입력("어제 스벅 4500 삼성카드 #카페")을 거래 필드로 변환하는 순수 함수 (AI/서버 호출 없음).
//
// 인식 규칙
//   금액   : 4500 / 4,500원 / 3천 / 1.5만 / 2만5천 / 3만원 / +5000(수입) / -5000(지출)
//   날짜   : 오늘 / 어제 / 그제 / 10/20 / 10.20 / 10월20일 / 20일   (없으면 오늘)
//            월/일은 180일 넘게 미래면 작년으로 해석, '20일'은 오늘 이전에서 가장 가까운 그 날
//   종류   : 수입 키워드(월급, 용돈 등)로 끝나는 단어가 있으면 INCOME, 아니면 EXPENSE
//            ('이자카야'처럼 키워드로 시작할 뿐인 단어는 제외. '월급날', '이자를' 같은 조사·접미사는 허용)
//            이체 키워드(이체, 카드값, 카드대금 등)가 있으면 TRANSFER.
//            '카드결제'는 "스벅 카드결제 4500" 같은 지출과 구분하려고 카드 + 비카드 자산이 함께 있을 때만 TRANSFER
//   태그   : #이름 (소속 카테고리도 함께 결정). '#' 없이 태그명과 같은 단어도 태그로 인식. 태그로 쓰인 단어는 내용에서 제거
//   카테고리: 카테고리명과 같은 단어
//   자산   : 자산명에 포함되는 2글자 이상 단어, 대소문자 무시, 끝의 은행/에서/으로/로 무시 (여러 개면 목록 앞쪽 자산)
//            이체는 자산 2개까지 인식. 카드는 항상 입금 쪽 ("카드결제 삼성카드 3만 kb" → KB → 삼성카드)
//            체크카드는 이체의 출금·입금 어느 쪽도 될 수 없어 이체 자산에서 제외
//   내용   : 위에서 쓰이지 않은 나머지 단어

import {isRealDate} from './month.js';

const pad = (n) => String(n).padStart(2, '0');

export const toLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayLocal = () => toLocalDate(new Date());

const INCOME_WORDS = ['월급', '급여', '용돈', '입금', '수입', '환급', '이자', '보너스', '상여', '캐시백', '배당', '부수입'];
const TRANSFER_WORDS = ['이체', '카드값', '카드대금', '카드납부', '대금결제'];
const CARD_PAYMENT_WORD = '카드결제';
const MEMO_MAX_LENGTH = 100;
const INCOME_WORD_SUFFIX = /^(?:을|를|이|가|은|는|도|날|로|으로|받음|받았음|들어옴)?$/;
const MAX_FUTURE_DAYS = 180; // 예정 거래(11월의 "12/25")는 올해로 두고, 연초의 "12/30"만 작년으로 본다
const DAY_MS = 86_400_000;

// 금액 토큰 해석. 금액이 아니면 null
function parseAmountToken(raw) {
  let t = raw.replace(/,/g, '');
  let sign = null;
  if (t[0] === '+' || t[0] === '-') {
    sign = t[0];
    t = t.slice(1);
  }
  const hasWon = t.endsWith('원');
  if (hasWon) t = t.slice(0, -1);
  if (!t) return null;

  const m = t.match(/^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)만)?(?:(\d+(?:\.\d+)?)천)?(?:(\d+(?:\.\d+)?)백)?(\d+)?$/);
  if (!m) return null;
  const [, eok, man, cheon, baek, rest] = m;
  if (!(eok || man || cheon || baek || rest)) return null;

  const n = (x) => (x ? Number(x) : 0);
  const value = Math.round(n(eok) * 1e8 + n(man) * 1e4 + n(cheon) * 1e3 + n(baek) * 100 + n(rest));
  const hasUnit = !!(eok || man || cheon || baek);
  const explicit = hasUnit || hasWon || sign !== null || raw.includes(',');
  if (value <= 0) return null;
  if (!explicit && value < 100) return null; // "3잔" 같은 수량과 구분하기 위해 단위 없는 100 미만은 제외
  return {value, explicit, sign};
}

// 연도 없는 월/일 → 날짜. 달력에 없는 날이면 null
function resolveMonthDay(month, day, base) {
  const year = base.getFullYear();
  const date = `${year}-${pad(month)}-${pad(day)}`;
  if (!isRealDate(date)) return null;
  const daysAhead = (new Date(year, month - 1, day) - base) / DAY_MS;
  return daysAhead > MAX_FUTURE_DAYS ? `${year - 1}-${pad(month)}-${pad(day)}` : date;
}

// 날짜 토큰 해석. 날짜가 아니면 null
function parseDateToken(t, now) {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (days) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return toLocalDate(d);
  };
  if (t === '오늘') return toLocalDate(base);
  if (t === '어제') return shift(-1);
  if (t === '그제' || t === '그저께') return shift(-2);

  let m = t.match(/^(\d{1,2})[/.\-](\d{1,2})$/) || t.match(/^(\d{1,2})월(\d{1,2})일?$/);
  if (m) return resolveMonthDay(Number(m[1]), Number(m[2]), base);

  m = t.match(/^(\d{1,2})일$/);
  if (m) {
    const da = Number(m[1]);
    if (da < 1 || da > 31) return null;
    // 오늘 이전에서 가장 가까운 그 날. 그 날이 없는 달(2월 31일 등)은 건너뛴다.
    // 없는 달이 두 번 연속될 수는 없으므로 두 달 전까지만 보면 된다
    for (let back = 0; back <= 2; back++) {
      const d = new Date(base.getFullYear(), base.getMonth() - back, da);
      if (d.getDate() === da && d <= base) return toLocalDate(d);
    }
  }
  return null;
}

const norm = (s) => String(s ?? '').replace(/^#/, '').trim();

// 자산 검색용 단어: 소문자로 맞추고 "kb은행에서" → "kb" 처럼 끝말을 제거
const assetWord = (word) => word.toLowerCase().replace(/(은행)?(에서|으로|로)?$/, '');

// 키워드 뒤에 조사·접미사만 붙은 단어인지 ('10월월급', '이자를'은 해당, '이자카야', '수입과자'는 아님)
const isIncomeToken = (tok) => INCOME_WORDS.some((word) => {
  const at = tok.lastIndexOf(word);
  return at >= 0 && INCOME_WORD_SUFFIX.test(tok.slice(at + word.length));
});

export function parseTransactionText(text, {assets = [], tags = [], categories = [], now = new Date()} = {}) {
  const tokens = String(text ?? '').split(/\s+/).filter(Boolean);
  const used = new Array(tokens.length).fill(false);

  const result = {
    type: 'EXPENSE',
    amount: null,
    date: null,
    assetId: null,
    tagId: null,
    categoryId: null,
    memo: '',
    toAssetId: null,
  };

  // 1) 금액: 단위/콤마/원/부호가 있는 토큰 우선(마지막 것), 없으면 마지막 맨숫자
  let amountIdx = -1;
  let amountInfo = null;
  tokens.forEach((tok, i) => {
    const info = parseAmountToken(tok);
    if (!info) return;
    if (!amountInfo || info.explicit || !amountInfo.explicit) {
      amountInfo = info;
      amountIdx = i;
    }
  });
  if (amountInfo) {
    result.amount = amountInfo.value;
    used[amountIdx] = true;
    if (amountInfo.sign === '+') result.type = 'INCOME';
    if (amountInfo.sign === '-') result.type = 'EXPENSE';
  }

  // 2) 날짜
  tokens.forEach((tok, i) => {
    if (used[i] || result.date) return;
    const d = parseDateToken(tok, now);
    if (d) {
      result.date = d;
      used[i] = true;
    }
  });

  // 3) 태그 (#이름 → 내용에서 제거)
  const findTag = (name) => tags.find((t) => norm(t.name) === name);
  tokens.forEach((tok, i) => {
    if (used[i] || result.tagId || !tok.startsWith('#')) return;
    const tag = findTag(norm(tok));
    if (tag) {
      result.tagId = tag.id;
      result.categoryId = tag.categoryId;
      used[i] = true;
    }
  });

  // 4) 카테고리명 / '#' 없는 태그명 / 자산명
  const assetMatches = []; // {asset, index} 입력 순서대로
  tokens.forEach((tok, i) => {
    if (used[i]) return;
    const word = norm(tok);
    if (!word) return;

    const category = categories.find((c) => c.name === word);
    if (category && result.categoryId == null) {
      result.categoryId = category.id;
      used[i] = true;
      return;
    }

    if (!result.tagId) {
      const tag = findTag(word);
      if (tag) {
        result.tagId = tag.id;
        result.categoryId = tag.categoryId; // 태그의 카테고리가 우선
        used[i] = true; // 태그로만 설정하고 내용에는 남기지 않음
        return;
      }
    }

    const keyword = assetWord(word);
    if (keyword.length >= 2 && assetMatches.length < 2) {
      const asset = assets.find(
        (a) => a.name && a.name.toLowerCase().includes(keyword) && !assetMatches.some((m) => m.asset.id === a.id));
      if (asset) assetMatches.push({asset, index : i});
    }
  });

  const hasWord = (words) => tokens.some((tok) => words.some((w) => tok.includes(w)));
  const hasCardAndAccount = assetMatches.some((m) => m.asset.type === 'CARD')
    && assetMatches.some((m) => m.asset.type !== 'CARD');
  const isTransfer = hasWord(TRANSFER_WORDS) || (hasWord([CARD_PAYMENT_WORD]) && hasCardAndAccount);

  // 이체가 아니면 첫 자산만 사용, 나머지 단어는 내용에 남김
  const pickedAssets = isTransfer
    ? assetMatches.filter((m) => m.asset.type !== 'CHECK_CARD')
    : assetMatches.slice(0, 1);
  pickedAssets.forEach((m) => {
    used[m.index] = true;
  });

  if (isTransfer) {
    // 카드는 출금 자산이 될 수 없으므로 입금 쪽으로 보냄 ("삼성카드 국민 이체" → 국민 → 삼성카드)
    const [first, second] = pickedAssets.map((m) => m.asset);
    if (first?.type === 'CARD' && second?.type !== 'CARD') {
      result.assetId = second?.id ?? null;
      result.toAssetId = first.id;
    } else {
      result.assetId = first?.id ?? null;
      result.toAssetId = second?.id ?? null;
    }
  } else {
    result.assetId = pickedAssets[0]?.asset.id ?? null;
  }

  // 5) 종류: 이체 키워드가 최우선, 그다음 수입 키워드 (부호로 이미 정해졌으면 유지)
  if (isTransfer) {
    result.type = 'TRANSFER';
  } else if (result.type !== 'INCOME' && !(amountInfo && amountInfo.sign === '-')) {
    if (tokens.some((tok) => isIncomeToken(norm(tok)))) result.type = 'INCOME';
  }

  // 6) 내용: 쓰이지 않은 나머지 ('#'만 붙은 미등록 태그는 '#' 제거)
  result.memo = tokens
    .filter((_, i) => !used[i])
    .map((tok) => tok.replace(/^#/, ''))
    .join(' ')
    .slice(0, MEMO_MAX_LENGTH);

  return result;
}


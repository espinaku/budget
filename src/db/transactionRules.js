// 거래 관련 순수 규칙 (DB 없이 테스트 가능). 백엔드 TransactionService / TransactionSpecs 이식.

// 수입/지출이 잔액에 반영되는 자산 종류 (CARD는 잔액 없음, INVESTMENT는 시세 변동이라 수동 유지)
export const BALANCE_TRACKED = ['CASH', 'BANK'];
// 이체는 투자 자산 입출금도 반영 (카드는 잔액이 없으므로 입금되어도 변화 없음 = 카드대금)
export const TRANSFER_TRACKED = ['CASH', 'BANK', 'INVESTMENT'];

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'];
export const ASSET_TYPES = ['CASH', 'BANK', 'CARD', 'CHECK_CARD', 'INVESTMENT'];
const AMOUNT_MAX = 999_999_999_999_999; // 프론트 입력 한도(15자리)와 동일

export const isValidAmount = (amount) => Number.isInteger(amount) && amount > 0 && amount <= AMOUNT_MAX;

export const isCardType = (type) => type === 'CARD' || type === 'CHECK_CARD';

// 두 종류의 잔액 반영 규칙이 같은지. 다르면 기존 거래의 효과를 되돌릴 때 잔액이 어긋난다
export const sameBalanceRule = (a, b) => a === b || (BALANCE_TRACKED.includes(a) && BALANCE_TRACKED.includes(b));

// 수입은 +amount, 지출은 -amount, 이체는 출금 자산 - / 입금 자산 +
export const effects = (type, amount, assetId, toAssetId) => {
  if (assetId == null) return [];
  switch (type) {
    case 'INCOME' : return [{assetId, delta : amount, types : BALANCE_TRACKED}];
    case 'EXPENSE' : return [{assetId, delta : -amount, types : BALANCE_TRACKED}];
    case 'TRANSFER' : return [
      {assetId, delta : -amount, types : TRANSFER_TRACKED},
      {assetId : toAssetId, delta : amount, types : TRANSFER_TRACKED},
    ];
    default : return [];
  }
};

// 체크카드 거래는 카드가 아닌 연결 계좌의 잔액을 바꾼다
export const balanceAssetId = (assetMap, assetId) => {
  if (assetId == null) return null;
  const asset = assetMap.get(assetId);
  return asset?.type === 'CHECK_CARD' && asset.linkedAssetId != null ? asset.linkedAssetId : assetId;
};

export const effectsOf = (assetMap, t) =>
  effects(t.type, t.amount, balanceAssetId(assetMap, t.assetId), t.toAssetId);

// 이 계좌에 연결된 체크카드 id 집합
export const linkedCardIds = (assets, assetId) =>
  new Set(assets.filter((a) => a.linkedAssetId === assetId).map((a) => a.id));

// 정렬: 거래일 내림차순, 같은 날은 id 내림차순 (최근 입력이 위)
export const compareTransactions = (a, b) =>
  a.transactionDate === b.transactionDate
    ? b.id - a.id
    : (a.transactionDate < b.transactionDate ? 1 : -1);

// 검색 조건을 정규화 (화면에서 문자열·빈 값이 섞여 들어옴)
export const normalizeCondition = (params = {}) => {
  const blank = (v) => v === '' || v == null;
  const id = (v) => (blank(v) ? null : Number(v));
  return {
    from : blank(params.from) ? null : params.from,
    to : blank(params.to) ? null : params.to,
    type : blank(params.type) ? null : params.type,
    assetId : id(params.assetId),
    assetType : blank(params.assetType) ? null : params.assetType,
    direction : blank(params.direction) ? null : params.direction,
    categoryId : id(params.categoryId),
    tagId : id(params.tagId),
    keyword : blank(params.keyword) ? null : String(params.keyword),
    page : Math.max(Number(params.page) || 0, 0),
    size : Math.min(Math.max(Number(params.size) || 30, 1), 100),
  };
};

// 검색 조건 → 거래 하나에 대한 판정 함수 (TransactionSpecs.search와 같은 규칙)
export const buildMatcher = (c, assets) => {
  const linked = c.assetId != null ? linkedCardIds(assets, c.assetId) : new Set();
  // assetId가 이 자산이거나 이 자산에 연결된 체크카드
  const ownedBy = (t) => t.assetId === c.assetId || linked.has(t.assetId);

  let tabAssetIds = null;
  if (c.assetType) {
    const tabTypes = c.assetType === 'BANK' ? ['BANK', 'CHECK_CARD'] : [c.assetType];
    tabAssetIds = new Set(assets.filter((a) => tabTypes.includes(a.type)).map((a) => a.id));
  }
  const keyword = c.keyword?.trim().toLowerCase() || null;

  return (t) => {
    if (c.from && t.transactionDate < c.from) return false;
    if (c.to && t.transactionDate > c.to) return false;
    if (c.type && t.type !== c.type) return false;

    if (c.assetId != null) {
      // 그 자산의 수입·지출, 출금·입금 어느 쪽이든 그 자산인 이체, 연결 체크카드의 수입·지출
      if (!(ownedBy(t) || t.toAssetId === c.assetId)) return false;
      if (c.direction === 'IN'
        && !((ownedBy(t) && t.type === 'INCOME') || (t.toAssetId === c.assetId && t.type === 'TRANSFER'))) return false;
      if (c.direction === 'OUT'
        && !((ownedBy(t) && t.type === 'EXPENSE') || (t.assetId === c.assetId && t.type === 'TRANSFER'))) return false;
    }

    if (tabAssetIds) {
      // 입출금 탭 = 계좌·체크카드 수입·지출 + 모든 이체 / 그 외 탭 = 그 종류 자산의 수입·지출만
      const incomeOrExpense = (t.type === 'INCOME' || t.type === 'EXPENSE') && tabAssetIds.has(t.assetId);
      const ok = c.assetType === 'BANK' ? (incomeOrExpense || t.type === 'TRANSFER') : incomeOrExpense;
      if (!ok) return false;
    }

    if (c.categoryId != null && t.categoryId !== c.categoryId) return false;
    if (c.tagId != null && t.tagId !== c.tagId) return false;
    if (keyword && !(t.memo ?? '').toLowerCase().includes(keyword)) return false;
    return true;
  };
};

// 조건 전체의 합계. 자산 필터가 있으면 이체는 그 자산 기준으로 입금/출금을 나누고, 없으면 양쪽 다 이체 총액
export const summarize = (list, assetId) => {
  const s = {income : 0, expense : 0, transferIn : 0, transferOut : 0};
  for (const t of list) {
    if (t.type === 'INCOME') s.income += t.amount;
    else if (t.type === 'EXPENSE') s.expense += t.amount;
    else if (t.type === 'TRANSFER') {
      if (assetId == null || assetId === t.toAssetId) s.transferIn += t.amount;
      if (assetId == null || assetId === t.assetId) s.transferOut += t.amount;
    }
  }
  return s;
};

// 자산의 거래별 "거래 후 잔액". 현재 잔액에서 최신 거래부터 효과를 거꾸로 빼 나간다.
// 카드(잔액 없음)면 빈 맵.
export const balancesAfter = (asset, assets, allTransactions) => {
  const result = new Map();
  if (!asset || isCardType(asset.type)) return result;
  const linked = linkedCardIds(assets, asset.id);
  const mine = allTransactions
    .filter((t) => t.assetId === asset.id || linked.has(t.assetId) || t.toAssetId === asset.id)
    .sort(compareTransactions);

  let running = asset.balance ?? 0;
  for (const t of mine) {
    result.set(t.id, running);
    const source = linked.has(t.assetId) ? asset.id : t.assetId;
    for (const e of effects(t.type, t.amount, source, t.toAssetId)) {
      if (e.assetId === asset.id && e.types.includes(asset.type)) running -= e.delta;
    }
  }
  return result;
};

// 검색과 같은 조건의 일별 수입/지출 합계 (이체 제외, 거래가 있는 날만, 날짜 오름차순)
export const dailySums = (list) => {
  const byDate = new Map();
  for (const t of list) {
    if (t.type === 'TRANSFER') continue;
    const sum = byDate.get(t.transactionDate) ?? {date : t.transactionDate, income : 0, expense : 0};
    if (t.type === 'INCOME') sum.income += t.amount;
    else sum.expense += t.amount;
    byDate.set(t.transactionDate, sum);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
};

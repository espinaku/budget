import {db, now} from '../db/db.js';
import {fail, toId} from '../db/errors.js';
import {
  balancesAfter, buildMatcher, compareTransactions, dailySums, effectsOf, isCardType, isValidAmount, normalizeCondition,
  summarize, TRANSACTION_TYPES,
} from '../db/transactionRules.js';
import {isRealDate} from '../utils/month.js';

// 백엔드 TransactionService 이식. 함수 이름·인자·반환 형태는 V1 API와 동일하게 유지해서 화면 코드는 그대로 쓴다.

const MEMO_MAX_LENGTH = 100;

// ---------- 조회 ----------

const withTag = (t, tagMap, balanceAfter = null) => {
  const tag = t.tagId != null ? tagMap.get(t.tagId) : null;
  return {
    ...t,
    tagName : tag?.name ?? null,
    tagColor : tag?.color ?? null,
    balanceAfter,
  };
};

const loadTagMap = async () => new Map((await db.tags.toArray()).map((t) => [t.id, t]));

const validatePeriod = (c) => {
  if (c.from && c.to && c.from > c.to) fail('STATS_PERIOD_INVALID');
};

// 기간·종류·자산·카테고리·태그·메모 필터 검색 (거래 화면, 자산 상세 공용)
export const searchTransactions = async (params) => {
  const c = normalizeCondition(params);
  validatePeriod(c);

  const [all, assets, tagMap] = await Promise.all([db.transactions.toArray(), db.assets.toArray(), loadTagMap()]);
  const matched = all.filter(buildMatcher(c, assets)).sort(compareTransactions);

  const start = c.page * c.size;
  const pageItems = matched.slice(start, start + c.size);
  const balances = c.assetId != null
    ? balancesAfter(assets.find((a) => a.id === c.assetId), assets, all)
    : new Map();

  return {
    items : pageItems.map((t) => withTag(t, tagMap, balances.get(t.id) ?? null)),
    page : c.page,
    size : c.size,
    hasNext : start + c.size < matched.length,
    totalCount : matched.length,
    summary : summarize(matched, c.assetId),
  };
};

// 검색과 같은 조건의 일별 수입/지출 합계 (거래 화면 달력용)
export const getDailySums = async (params) => {
  const c = normalizeCondition(params);
  validatePeriod(c);
  const [all, assets] = await Promise.all([db.transactions.toArray(), db.assets.toArray()]);
  return dailySums(all.filter(buildMatcher(c, assets)));
};

export const getTransaction = async (id) => {
  const t = await db.transactions.get(Number(id));
  if (!t) fail('TRANSACTION_NOT_FOUND');
  return withTag(t, await loadTagMap());
};

// ---------- 저장 / 수정 / 삭제 ----------

// 화면 검증을 거치지 않은 호출도 잔액·통계를 망가뜨리지 않도록 다시 확인 (백업 파일은 backupApi에서 검사)
const validateRequest = (r) => {
  if (!TRANSACTION_TYPES.includes(r.type)
    || !isRealDate(r.transactionDate)
    || !isValidAmount(Number(r.amount))
    || (r.memo != null && String(r.memo).length > MEMO_MAX_LENGTH)) {
    fail('TRANSACTION_INVALID');
  }
};

// 요청 값 검증 후 저장할 행(필드)을 만든다. before: 수정 전 거래
const buildRow = async (request, before = null) => {
  validateRequest(request);
  const type = request.type;
  const transfer = type === 'TRANSFER';
  const assetId = toId(request.assetId);
  const toAssetId = transfer ? toId(request.toAssetId) : null;
  const categoryId = transfer ? null : toId(request.categoryId);
  const tagId = transfer ? null : toId(request.tagId);

  // 이체는 카테고리 없음, 그 외는 카테고리 필수
  if (!transfer && (categoryId == null || !(await db.categories.get(categoryId)))) fail('CATEGORY_NOT_FOUND');
  if (tagId != null) {
    const tag = await db.tags.get(tagId);
    if (!tag) fail('TAG_NOT_FOUND');
    // 태그를 다른 카테고리로 옮기면 과거 거래의 조합이 어긋날 수 있으므로, 조합을 바꾸지 않는 수정은 허용
    const unchanged = before?.tagId === tagId && before?.categoryId === categoryId;
    if (tag.categoryId !== categoryId && !unchanged) fail('TAG_CATEGORY_MISMATCH');
  }

  if (transfer) {
    if (assetId == null || toAssetId == null || assetId === toAssetId) fail('TRANSFER_INVALID');
    const [from, to] = await Promise.all([db.assets.get(assetId), db.assets.get(toAssetId)]);
    if (!from || !to) fail('ASSET_NOT_FOUND');
    // 카드류는 출금 자산이 될 수 없고, 체크카드는 대금이 없으니 입금 자산도 될 수 없다
    if (isCardType(from.type) || to.type === 'CHECK_CARD') fail('TRANSFER_INVALID');
  } else if (assetId != null && !(await db.assets.get(assetId))) {
    fail('ASSET_NOT_FOUND');
  }

  return {
    type,
    amount : Number(request.amount),
    memo : request.memo ?? '',
    transactionDate : request.transactionDate,
    categoryId,
    assetId,
    toAssetId,
    tagId,
  };
};

// 잔액 반영. sign: 1 = 반영, -1 = 되돌림 (AssetRepository.adjustBalance)
const applyEffects = async (effectList, sign) => {
  for (const e of effectList) {
    if (e.assetId == null || e.delta === 0) continue;
    const asset = await db.assets.get(e.assetId);
    if (!asset || !e.types.includes(asset.type)) continue;
    await db.assets.update(asset.id, {balance : (asset.balance ?? 0) + sign * e.delta, updatedAt : now()});
  }
};

const assetMap = async () => new Map((await db.assets.toArray()).map((a) => [a.id, a]));

export const createTransaction = async (payload) =>
  db.transaction('rw', db.transactions, db.assets, db.categories, db.tags, async () => {
    const row = await buildRow(payload);
    const saved = {...row, aiSource : 'MANUAL', createdAt : now(), updatedAt : now()};
    saved.id = await db.transactions.add(saved);
    await applyEffects(effectsOf(await assetMap(), saved), 1);
    return withTag(saved, await loadTagMap());
  });

export const updateTransaction = async (id, payload) =>
  db.transaction('rw', db.transactions, db.assets, db.categories, db.tags, async () => {
    const before = await db.transactions.get(Number(id));
    if (!before) fail('TRANSACTION_NOT_FOUND');
    const row = await buildRow(payload, before);

    const map = await assetMap();
    const oldEffects = effectsOf(map, before);
    const after = {...before, ...row, updatedAt : now()};
    await db.transactions.put(after);

    await applyEffects(oldEffects, -1); // 이전 효과 되돌림
    await applyEffects(effectsOf(map, after), 1); // 새 효과 반영
    return withTag(after, await loadTagMap());
  });

export const deleteTransaction = async (id) =>
  db.transaction('rw', db.transactions, db.assets, async () => {
    const before = await db.transactions.get(Number(id));
    if (!before) fail('TRANSACTION_NOT_FOUND');
    await db.transactions.delete(before.id);
    await applyEffects(effectsOf(await assetMap(), before), -1);
  });

// ---------- 메모 기반 추천 (SuggestionService) ----------

const topCounts = (list, keyOf, limit = 3) => {
  const counts = new Map();
  for (const t of list) {
    const key = keyOf(t);
    if (key == null) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
};

export const getSuggestions = async (memo) => {
  const empty = {keyword : memo, matchedCount : 0, categories : [], tags : [], assets : []};
  const keyword = (memo ?? '').trim().toLowerCase();
  if (!keyword) return empty;

  const all = await db.transactions.toArray();
  const matched = all.filter((t) => (t.memo ?? '').toLowerCase().includes(keyword));
  if (!matched.length) return empty;

  const [categories, tags, assets] = await Promise.all([
    db.categories.toArray(), db.tags.toArray(), db.assets.toArray(),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const assetById = new Map(assets.map((a) => [a.id, a]));

  // 숨긴 카테고리는 추천하지 않음
  const categoryItems = topCounts(matched, (t) => (categoryMap.get(t.categoryId)?.isVisible ? t.categoryId : null))
    .map(([id, count]) => {
      const c = categoryMap.get(id);
      return {id, name : c.name, icon : c.icon, color : c.color, count};
    });
  const tagItems = topCounts(matched, (t) => (tagMap.has(t.tagId) ? t.tagId : null))
    .map(([id, count]) => {
      const t = tagMap.get(id);
      return {id, name : t.name, color : t.color, categoryId : t.categoryId, count};
    });
  // 비활성 자산은 상위 3개를 뽑은 뒤 제외 (백엔드와 동일)
  const assetItems = topCounts(matched, (t) => (assetById.has(t.assetId) ? t.assetId : null))
    .filter(([id]) => assetById.get(id).isActive)
    .map(([id, count]) => {
      const a = assetById.get(id);
      return {id, name : a.name, type : a.type, count};
    });

  return {keyword : memo, matchedCount : matched.length, categories : categoryItems, tags : tagItems, assets : assetItems};
};

import {db, now} from '../db/db.js';
import {fail, rearrange, requireText, toId} from '../db/errors.js';
import {ASSET_TYPES, isCardType, sameBalanceRule} from '../db/transactionRules.js';

// 백엔드 AssetService 이식

const NAME_MAX_LENGTH = 30;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const sorted = () => db.assets.orderBy('sortOrder').toArray();

export const getAssets = async (includeInactive) => {
  const all = await sorted();
  return includeInactive ? all : all.filter((a) => a.isActive);
};

export const getAsset = async (id) => {
  const asset = await db.assets.get(Number(id));
  if (!asset) fail('ASSET_NOT_FOUND');
  return asset;
};

// 카드류(신용·체크)는 잔액이 없음
const balanceOf = (payload) => {
  if (isCardType(payload.type)) return null;
  const value = payload.balance;
  return value === '' || value == null ? null : Number(value);
};

// 체크카드는 입출금 계좌(BANK) 연결 필수, 그 외 종류는 연결 없음
const resolveLinkedAsset = async (selfId, payload) => {
  if (payload.type !== 'CHECK_CARD') return null;
  const linkedId = toId(payload.linkedAssetId);
  if (linkedId == null || linkedId === selfId) fail('ASSET_LINK_INVALID');
  const linked = await db.assets.get(linkedId);
  if (!linked || linked.type !== 'BANK') fail('ASSET_LINK_INVALID');
  return linkedId;
};

const validatePayload = (payload) => {
  requireText(payload.name, NAME_MAX_LENGTH);
  if (!ASSET_TYPES.includes(payload.type)) fail('INVALID_REQUEST');
};

export const createAsset = async (payload) =>
  db.transaction('rw', db.assets, async () => {
    validatePayload(payload);
    const linkedAssetId = await resolveLinkedAsset(null, payload);
    const last = await db.assets.orderBy('sortOrder').last();
    const asset = {
      name : payload.name,
      type : payload.type,
      balance : balanceOf(payload),
      sortOrder : last ? last.sortOrder + 1 : 0,
      isActive : true,
      linkedAssetId,
      createdAt : now(),
      updatedAt : now(),
    };
    asset.id = await db.assets.add(asset);
    return asset;
  });

export const updateAsset = async (id, payload) =>
  db.transaction('rw', db.assets, db.transactions, async () => {
    validatePayload(payload);
    const asset = await getAsset(id);
    const linkedAssetId = await resolveLinkedAsset(asset.id, payload);

    // 체크카드 거래는 연결 계좌 잔액에 반영돼 있으므로, 거래가 있으면 체크카드 여부·연결 계좌를 바꿀 수 없음
    const wasCheck = asset.type === 'CHECK_CARD';
    const isCheck = payload.type === 'CHECK_CARD';
    const changed = wasCheck !== isCheck || (wasCheck && asset.linkedAssetId !== linkedAssetId);
    if (changed && (await db.transactions.where('assetId').equals(asset.id).count()) > 0) {
      fail('ASSET_LINK_LOCKED');
    }

    // 체크카드는 입출금 계좌에만 연결되므로, 연결된 카드가 있으면 계좌가 아닌 종류로 바꿀 수 없음
    if (asset.type === 'BANK' && payload.type !== 'BANK'
      && (await db.assets.where('linkedAssetId').equals(asset.id).count()) > 0) {
      fail('ASSET_HAS_LINKED_CARDS');
    }

    // 잔액 반영 규칙이 달라지면 기존 거래를 수정·삭제할 때 잔액이 어긋나므로 거래가 있으면 막음
    if (!sameBalanceRule(asset.type, payload.type)) {
      const used = (await db.transactions.where('assetId').equals(asset.id).count())
        + (await db.transactions.where('toAssetId').equals(asset.id).count());
      if (used > 0) fail('ASSET_TYPE_LOCKED');
    }

    const next = {
      ...asset,
      name : payload.name,
      type : payload.type,
      balance : balanceOf(payload),
      linkedAssetId,
      updatedAt : now(),
    };
    await db.assets.put(next);
    return next;
  });

export const reorderAssets = async (ids) =>
  db.transaction('rw', db.assets, async () => {
    const arranged = rearrange(await sorted(), ids);
    await Promise.all(arranged.map((a, i) => (a.sortOrder === i ? null : db.assets.update(a.id, {sortOrder : i}))));
  });

export const deactivateAsset = async (id) => {
  const asset = await getAsset(id);
  await db.assets.update(asset.id, {isActive : false, updatedAt : now()});
};

export const activateAsset = async (id) => {
  const asset = await getAsset(id);
  await db.assets.update(asset.id, {isActive : true, updatedAt : now()});
};

// 월별 자산 사용액 (달력 기준 1일~말일)
export const getAssetUsage = async (month) => {
  if (!MONTH_PATTERN.test(month ?? '')) fail('STATS_PERIOD_INVALID');
  const prefix = `${month}-`;
  const list = (await db.transactions.where('transactionDate').startsWith(prefix).toArray());

  const byAsset = new Map(); // assetId -> {income, expense, transferIn, transferOut}
  const bucket = (id) => {
    if (!byAsset.has(id)) byAsset.set(id, {assetId : id, income : 0, expense : 0, transferIn : 0, transferOut : 0});
    return byAsset.get(id);
  };

  for (const t of list) {
    if (t.type === 'TRANSFER') {
      if (t.assetId != null) bucket(t.assetId).transferOut += t.amount;
      if (t.toAssetId != null) bucket(t.toAssetId).transferIn += t.amount;
    } else if (t.assetId != null) {
      bucket(t.assetId)[t.type === 'INCOME' ? 'income' : 'expense'] += t.amount;
    }
  }

  // 체크카드 사용분은 연결 계좌의 수입·지출에도 더함 (연결 계좌 잔액에서 실제로 빠져나간 돈)
  for (const card of await db.assets.toArray()) {
    if (card.type !== 'CHECK_CARD' || card.linkedAssetId == null) continue;
    const usage = byAsset.get(card.id);
    if (!usage) continue;
    const linked = bucket(card.linkedAssetId);
    linked.income += usage.income;
    linked.expense += usage.expense;
  }
  return [...byAsset.values()];
};

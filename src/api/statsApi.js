import {db} from '../db/db.js';
import {fail} from '../db/errors.js';

// 백엔드 StatsService 이식

const MAX_MONTHLY_RANGE = 24;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const parseMonth = (value) => {
  if (!MONTH_PATTERN.test(value ?? '')) fail('STATS_PERIOD_INVALID');
  const [y, m] = value.split('-').map(Number);
  return y * 12 + (m - 1); // 월 단위 정수 (비교·차이 계산용)
};
const formatMonth = (index) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;

const ofMonth = (month) => db.transactions.where('transactionDate').startsWith(`${month}-`).toArray();

// 월별 수입/지출 추이 (거래가 없는 달도 0으로 포함, 이체 제외)
export const getMonthlyStats = async (from, to) => {
  const start = parseMonth(from);
  const end = parseMonth(to);
  if (start > end || end - start >= MAX_MONTHLY_RANGE) fail('STATS_PERIOD_INVALID');

  const byMonth = new Map();
  for (let i = start; i <= end; i++) byMonth.set(formatMonth(i), {month : formatMonth(i), income : 0, expense : 0});

  const list = await db.transactions.where('transactionDate').between(`${from}-01`, `${to}-31`, true, true).toArray();
  for (const t of list) {
    const bucket = byMonth.get(t.transactionDate.slice(0, 7));
    if (!bucket || t.type === 'TRANSFER') continue;
    bucket[t.type === 'INCOME' ? 'income' : 'expense'] += t.amount;
  }
  return {items : [...byMonth.values()]};
};

// 카테고리별 합계 (태그 유무와 무관하게 전체 거래, 금액 큰 순)
export const getCategoryStats = async (month, type) => {
  parseMonth(month);
  const effectiveType = type || 'EXPENSE';
  const categories = new Map((await db.categories.toArray()).map((c) => [c.id, c]));

  const sums = new Map();
  for (const t of await ofMonth(month)) {
    if (t.type !== effectiveType || !categories.has(t.categoryId)) continue;
    const c = categories.get(t.categoryId);
    const item = sums.get(c.id) ?? {categoryId : c.id, categoryName : c.name, color : c.color, totalAmount : 0, transactionCount : 0};
    item.totalAmount += t.amount;
    item.transactionCount += 1;
    sums.set(c.id, item);
  }
  const items = [...sums.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  return {
    month,
    type : effectiveType,
    totalAmount : items.reduce((sum, i) => sum + i.totalAmount, 0),
    items,
  };
};

// 태그별 합계 + 태그를 카테고리별로 묶은 합계 (태그 있는 거래만)
export const getTagStats = async (month, type) => {
  parseMonth(month);
  const effectiveType = type || 'EXPENSE';
  const [tags, categories] = await Promise.all([db.tags.toArray(), db.categories.toArray()]);
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const sums = new Map();
  for (const t of await ofMonth(month)) {
    if (t.type !== effectiveType || !tagMap.has(t.tagId)) continue;
    const tag = tagMap.get(t.tagId);
    const item = sums.get(tag.id) ?? {
      tagId : tag.id,
      tagName : tag.name,
      tagColor : tag.color,
      categoryId : tag.categoryId,
      categoryName : categoryMap.get(tag.categoryId)?.name ?? null,
      totalAmount : 0,
      transactionCount : 0,
    };
    item.totalAmount += t.amount;
    item.transactionCount += 1;
    sums.set(tag.id, item);
  }

  const tagItems = [...sums.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  const byCategory = new Map();
  for (const item of tagItems) {
    const c = byCategory.get(item.categoryId)
      ?? {categoryId : item.categoryId, categoryName : item.categoryName, totalAmount : 0, transactionCount : 0};
    c.totalAmount += item.totalAmount;
    c.transactionCount += item.transactionCount;
    byCategory.set(item.categoryId, c);
  }

  return {
    month,
    type : effectiveType,
    totalAmount : tagItems.reduce((sum, i) => sum + i.totalAmount, 0),
    categories : [...byCategory.values()],
    tags : tagItems,
  };
};

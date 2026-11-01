import {db, now} from '../db/db.js';
import {fail, requireText, toId} from '../db/errors.js';

// 백엔드 TagService 이식

const NAME_MAX_LENGTH = 30;
const PAGE_MAX_SIZE = 100;

// 응답에 카테고리 이름을 함께 담는다 (TagResponse)
const withCategoryName = async (tags) => {
  const categories = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
  return tags.map((t) => ({...t, categoryName : categories.get(t.categoryId)?.name ?? null}));
};

const listOf = async (categoryId) => {
  const id = toId(categoryId);
  const tags = id != null
    ? await db.tags.where('categoryId').equals(id).toArray()
    : await db.tags.toArray();
  return tags.sort((a, b) => a.id - b.id);
};

// categoryId 없으면 전체
export const getTags = async (categoryId) => withCategoryName(await listOf(categoryId));

// 태그 관리 화면용 페이지 조회
export const getTagPage = async ({categoryId, page = 0, size = 30} = {}) => {
  const all = await listOf(categoryId);
  const p = Math.max(Number(page) || 0, 0);
  const s = Math.min(Math.max(Number(size) || 30, 1), PAGE_MAX_SIZE);
  const start = p * s;
  return {
    items : await withCategoryName(all.slice(start, start + s)),
    page : p,
    size : s,
    hasNext : start + s < all.length,
    totalCount : all.length,
  };
};

const requireCategory = async (categoryId) => {
  const id = toId(categoryId);
  if (id == null || !(await db.categories.get(id))) fail('CATEGORY_NOT_FOUND');
  return id;
};

export const createTag = async (payload) => {
  requireText(payload.name, NAME_MAX_LENGTH);
  const categoryId = await requireCategory(payload.categoryId);
  const tag = {categoryId, name : payload.name, color : payload.color ?? null, createdAt : now(), updatedAt : now()};
  tag.id = await db.tags.add(tag);
  return (await withCategoryName([tag]))[0];
};

export const updateTag = async (id, payload) => {
  requireText(payload.name, NAME_MAX_LENGTH);
  const tag = await db.tags.get(Number(id));
  if (!tag) fail('TAG_NOT_FOUND');
  const categoryId = await requireCategory(payload.categoryId);
  const next = {...tag, categoryId, name : payload.name, color : payload.color ?? null, updatedAt : now()};
  await db.tags.put(next);
  return (await withCategoryName([next]))[0];
};

// 태그를 지우면 그 태그를 쓰던 거래는 태그 없음으로 남는다
export const deleteTag = async (id) =>
  db.transaction('rw', db.tags, db.transactions, async () => {
    const tag = await db.tags.get(Number(id));
    if (!tag) fail('TAG_NOT_FOUND');
    await db.transactions.where('tagId').equals(tag.id).modify({tagId : null});
    await db.tags.delete(tag.id);
  });

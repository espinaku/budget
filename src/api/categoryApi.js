import {db, now} from '../db/db.js';
import {fail, rearrange, requireText} from '../db/errors.js';

// 백엔드 CategoryService 이식

const NAME_MAX_LENGTH = 30;

const sorted = () => db.categories.orderBy('sortOrder').toArray();

const find = async (id) => {
  const category = await db.categories.get(Number(id));
  if (!category) fail('CATEGORY_NOT_FOUND');
  return category;
};

export const getCategories = () => sorted();

export const createCategory = async (payload) =>
  db.transaction('rw', db.categories, async () => {
    requireText(payload.name, NAME_MAX_LENGTH);
    const last = await db.categories.orderBy('sortOrder').last();
    const category = {
      name : payload.name,
      icon : payload.icon ?? null,
      color : payload.color ?? null,
      isDefault : false,
      isVisible : true,
      sortOrder : last ? last.sortOrder + 1 : 0,
      createdAt : now(),
      updatedAt : now(),
    };
    category.id = await db.categories.add(category);
    return category;
  });

export const updateCategory = async (id, payload) => {
  requireText(payload.name, NAME_MAX_LENGTH);
  const category = await find(id);
  const next = {...category, name : payload.name, icon : payload.icon ?? null, color : payload.color ?? null, updatedAt : now()};
  await db.categories.put(next);
  return next;
};

export const reorderCategories = async (ids) =>
  db.transaction('rw', db.categories, async () => {
    const arranged = rearrange(await sorted(), ids);
    await Promise.all(arranged.map((c, i) => (c.sortOrder === i ? null : db.categories.update(c.id, {sortOrder : i}))));
  });

export const deleteCategory = async (id) =>
  db.transaction('rw', db.categories, db.tags, db.transactions, async () => {
    const category = await find(id);
    if (category.isDefault) fail('CATEGORY_NOT_DELETABLE');
    const inUse = (await db.tags.where('categoryId').equals(category.id).count()) > 0
      || (await db.transactions.where('categoryId').equals(category.id).count()) > 0;
    if (inUse) fail('CATEGORY_IN_USE');
    await db.categories.delete(category.id);
  });

export const toggleCategoryVisibility = async (id) => {
  const category = await find(id);
  await db.categories.update(category.id, {isVisible : !category.isVisible, updatedAt : now()});
};

import Dexie from 'dexie';

// 브라우저(IndexedDB) 저장소. 백엔드의 PostgreSQL 테이블을 대신한다.
// 인덱스(두 번째 인자)는 조회 조건에 쓰는 컬럼만 적는다. 나머지 필드는 자유롭게 저장됨.
export const db = new Dexie('budget');

db.version(1).stores({
  categories   : '++id, sortOrder',
  assets       : '++id, sortOrder, type, linkedAssetId',
  tags         : '++id, categoryId',
  transactions : '++id, transactionDate, type, assetId, toAssetId, categoryId, tagId',
  meta         : 'key', // 마지막 백업 시각 등 앱 설정 (백업 대상 아님)
});

// 기본 카테고리 (백엔드 DefaultCategories.java와 동일)
export const DEFAULT_CATEGORIES = [
  {name : '생활비', icon : '🏠', color : '#4A90D9'},
  {name : '식비', icon : '🍽️', color : '#E67E22'},
  {name : '쇼핑', icon : '🛍️', color : '#9B59B6'},
  {name : '건강', icon : '🏥', color : '#1E8449'},
  {name : '여가', icon : '🎮', color : '#1ABC9C'},
  {name : '경조사', icon : '🎁', color : '#E91E63'},
  {name : '수입', icon : '💰', color : '#F1C40F'},
  {name : '기타', icon : '📦', color : '#95A5A6'},
];

export const now = () => new Date().toISOString();

export const defaultCategoryRows = () => DEFAULT_CATEGORIES.map((c, i) => ({
  ...c,
  isDefault : true,
  isVisible : true,
  sortOrder : i,
  createdAt : now(),
  updatedAt : now(),
}));

// DB가 처음 만들어질 때 한 번만 실행 (백엔드의 프로필 생성 시 기본 카테고리 생성과 같은 역할)
db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(defaultCategoryRows());
});

// 메타 값 읽기/쓰기
export const getMeta = async (key) => (await db.meta.get(key))?.value ?? null;
export const setMeta = (key, value) => db.meta.put({key, value});

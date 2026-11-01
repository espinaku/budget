import {db, getMeta, now, setMeta} from '../db/db.js';
import {fail} from '../db/errors.js';
import {ASSET_TYPES, isValidAmount, TRANSACTION_TYPES} from '../db/transactionRules.js';
import {isRealDate} from '../utils/month.js';

// JSON 백업 / 복원. 파일은 iOS 공유 시트로 "파일에 저장 → iCloud Drive"에 보관한다.

const APP_ID = 'budget-pwa';
const FORMAT_VERSION = 1;
const TABLES = ['categories', 'assets', 'tags', 'transactions'];
const LAST_BACKUP_KEY = 'lastBackupAt';

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;

export const buildBackup = async () => {
  const data = {};
  for (const name of TABLES) data[name] = await db.table(name).toArray();
  return {app : APP_ID, version : FORMAT_VERSION, exportedAt : now(), data};
};

// 백업 파일 생성 후 공유 시트(iOS) 또는 다운로드(PC)로 내보낸다.
// 반환값: 'shared' | 'downloaded' | 'cancelled'
export const exportBackup = async () => {
  const backup = await buildBackup();
  const fileName = `budget-backup-${stamp()}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type : 'application/json'});
  const file = new File([blob], fileName, {type : 'application/json'});

  if (navigator.canShare?.({files : [file]})) {
    try {
      await navigator.share({files : [file], title : fileName});
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'; // 사용자가 공유 시트를 닫음
      throw e;
    }
    await setMeta(LAST_BACKUP_KEY, now());
    return 'shared';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await setMeta(LAST_BACKUP_KEY, now());
  return 'downloaded';
};

const isRow = (row) => row && typeof row === 'object' && Number.isInteger(row.id);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isId = Number.isInteger;

// 복원은 현재 데이터를 전부 교체하므로, 잔액·통계·정렬에 쓰이는 필드를 테이블별로 미리 확인한다.
// 앱이 내보낸 파일이면 언제나 통과하는 조건만 둔다.
const ROW_CHECKS = {
  categories : (r) => isText(r.name) && Number.isInteger(r.sortOrder),
  assets : (r) => isText(r.name) && ASSET_TYPES.includes(r.type) && Number.isInteger(r.sortOrder)
    && (r.balance == null || Number.isFinite(r.balance)),
  tags : (r) => isText(r.name) && isId(r.categoryId),
  transactions : (r) => TRANSACTION_TYPES.includes(r.type) && isValidAmount(r.amount) && isRealDate(r.transactionDate)
    && (r.type === 'TRANSFER'
      ? isId(r.assetId) && isId(r.toAssetId)
      : isId(r.categoryId) && (r.assetId == null || isId(r.assetId))),
};

// 파일 내용 검사. 통과하면 테이블별 건수를 돌려준다 (복원 전 확인용)
export const inspectBackup = (json) => {
  let backup;
  try {
    backup = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    fail('BACKUP_INVALID');
  }
  if (backup?.app !== APP_ID || backup.version !== FORMAT_VERSION || !backup.data) fail('BACKUP_INVALID');
  for (const name of TABLES) {
    const rows = backup.data[name];
    if (!Array.isArray(rows) || !rows.every((row) => isRow(row) && ROW_CHECKS[name](row))) fail('BACKUP_INVALID');
  }
  return {
    backup,
    exportedAt : backup.exportedAt,
    counts : Object.fromEntries(TABLES.map((name) => [name, backup.data[name].length])),
  };
};

// 현재 데이터를 모두 지우고 백업 내용으로 교체 (id 그대로 유지)
export const restoreBackup = async (backup) => {
  inspectBackup(backup);
  await db.transaction('rw', TABLES.map((name) => db.table(name)), async () => {
    for (const name of TABLES) {
      await db.table(name).clear();
      await db.table(name).bulkAdd(backup.data[name]);
    }
  });
};

export const getLastBackupAt = () => getMeta(LAST_BACKUP_KEY);

export const getDataCounts = async () =>
  Object.fromEntries(await Promise.all(TABLES.map(async (name) => [name, await db.table(name).count()])));

// 저장소 영구 보관 요청 (iOS가 오래 안 쓴 사이트 데이터를 정리하지 않도록)
export const requestPersistentStorage = async () => {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
};

export const isStoragePersisted = async () => (navigator.storage?.persisted ? navigator.storage.persisted() : false);

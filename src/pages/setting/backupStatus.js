// 백업 경과일 계산·표시 (설정 화면, 대시보드 알림, 백업 화면 공용)

export const BACKUP_WARN_DAYS = 7;

// 마지막 백업 이후 지난 날짜 수 (달력 기준). 백업한 적 없으면 null
export const daysSince = (iso) => {
  if (!iso) return null;
  const then = new Date(iso);
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(new Date()) - start(then)) / 86_400_000);
};

export const formatDateTime = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 설정 목록에 보일 짧은 문구
export const backupInfo = (iso) => {
  const days = daysSince(iso);
  if (days == null) return '백업 안 함';
  return days === 0 ? '오늘 백업' : `${days}일 전`;
};

// 백업 알림이 필요한지 (거래가 하나라도 있고, 백업한 적 없거나 7일 이상 지남)
export const needsBackup = (iso, transactionCount) =>
  transactionCount > 0 && (iso == null || daysSince(iso) >= BACKUP_WARN_DAYS);

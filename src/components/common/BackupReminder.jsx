import {Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {getDataCounts, getLastBackupAt} from "../../api/backupApi.js";
import {daysSince, needsBackup} from "../../pages/setting/backupStatus.js";

// 대시보드 상단 백업 알림. 거래가 있는데 7일 넘게 백업하지 않았으면 표시
function BackupReminder() {
  const {data : lastBackupAt, isSuccess : lastLoaded} = useQuery({queryKey : ['backup', 'last'], queryFn : getLastBackupAt});
  const {data : counts} = useQuery({queryKey : ['backup', 'counts'], queryFn : getDataCounts});

  if (!lastLoaded || !counts || !needsBackup(lastBackupAt, counts.transactions)) return null;

  const days = daysSince(lastBackupAt);
  return (
    <Link to="/settings/backup" className="backup-reminder">
      <span>{days == null ? '아직 백업한 적이 없어요.' : `마지막 백업이 ${days}일 전이에요.`}</span>
      <strong>지금 백업하기 ›</strong>
    </Link>
  );
}

export default BackupReminder;

import {useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {
  exportBackup, getDataCounts, getLastBackupAt, inspectBackup, isStoragePersisted, requestPersistentStorage, restoreBackup,
} from "../../api/backupApi.js";
import {getErrorMessage} from "../../api/errorMessage.js";
import Button from "../../components/common/Button.jsx";
import TopBar from "../../components/common/TopBar.jsx";
import {daysSince, formatDateTime} from "./backupStatus.js";

const COUNT_LABELS = [
  ['transactions', '거래'],
  ['assets', '자산'],
  ['categories', '카테고리'],
  ['tags', '태그'],
];

// 데이터 백업·복원 화면.
// 데이터는 이 기기(브라우저)에만 있으므로, 주기적으로 JSON 파일을 iCloud Drive 등에 저장해 둔다.
function BackupPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const {data : lastBackupAt} = useQuery({queryKey : ['backup', 'last'], queryFn : getLastBackupAt});
  const {data : counts} = useQuery({queryKey : ['backup', 'counts'], queryFn : getDataCounts});
  const {data : persisted} = useQuery({queryKey : ['backup', 'persisted'], queryFn : isStoragePersisted});

  const days = daysSince(lastBackupAt);

  const handleExport = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await exportBackup();
      if (result === 'cancelled') return;
      setMessage(result === 'shared'
        ? '백업 파일을 내보냈습니다. "파일에 저장"을 골랐다면 iCloud Drive에서 확인할 수 있습니다.'
        : '백업 파일을 다운로드했습니다.');
      queryClient.invalidateQueries({queryKey : ['backup']});
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 change가 일어나도록
    if (!file) return;
    setMessage('');
    try {
      const {backup, exportedAt, counts : c} = inspectBackup(await file.text());
      const ok = window.confirm(
        `${formatDateTime(exportedAt)} 백업\n거래 ${c.transactions}건 · 자산 ${c.assets}개 · 카테고리 ${c.categories}개 · 태그 ${c.tags}개\n\n`
        + '현재 이 기기의 데이터는 모두 지워지고 백업 내용으로 바뀝니다. 계속할까요?'
      );
      if (!ok) return;
      setBusy(true);
      await restoreBackup(backup);
      queryClient.invalidateQueries(); // 모든 화면 데이터 다시 조회
      setMessage('복원했습니다.');
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePersist = async () => {
    const granted = await requestPersistentStorage();
    queryClient.invalidateQueries({queryKey : ['backup', 'persisted']});
    if (!granted) alert('브라우저가 요청을 거절했습니다. 홈 화면에 추가한 앱에서 다시 시도해 보세요.');
  };

  return (
    <div className="page">
      <TopBar title="백업 · 복원" backTo="/settings"/>

      <section className="form-card backup-card">
        <h3 className="form-title">현재 데이터</h3>
        <dl className="backup-counts">
          {COUNT_LABELS.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{counts ? counts[key].toLocaleString() : '-'}</dd>
            </div>
          ))}
        </dl>
        <p className={`backup-status${days == null || days >= 7 ? ' is-warning' : ''}`}>
          {lastBackupAt
            ? `마지막 백업: ${formatDateTime(lastBackupAt)} (${days === 0 ? '오늘' : `${days}일 전`})`
            : '아직 백업한 적이 없습니다.'}
        </p>
      </section>

      <section className="form-card backup-card">
        <h3 className="form-title">백업하기</h3>
        <p className="backup-help">
          JSON 파일로 내보냅니다. 공유 화면에서 <b>파일에 저장 → iCloud Drive</b>를 고르면
          아이패드·맥에서도 볼 수 있습니다. 일주일에 한 번 이상 권장합니다.
        </p>
        <Button onClick={handleExport} disabled={busy}>백업 파일 내보내기</Button>
      </section>

      <section className="form-card backup-card">
        <h3 className="form-title">복원하기</h3>
        <p className="backup-help">
          백업 파일을 불러옵니다. <b>이 기기의 현재 데이터는 모두 바뀝니다.</b> 새 기기로 옮길 때나
          아이패드에서 폰 데이터를 보고 싶을 때 사용하세요.
        </p>
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
          백업 파일 불러오기
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleFile}/>
      </section>

      <section className="form-card backup-card">
        <h3 className="form-title">저장소 보호</h3>
        <p className="backup-help">
          {persisted
            ? '이 기기에 데이터를 계속 보관하도록 설정되어 있습니다.'
            : '브라우저가 저장 공간이 부족할 때 데이터를 정리하지 않도록 요청합니다. 그래도 백업은 꼭 해 두세요.'}
        </p>
        {!persisted && <Button variant="ghost" size="sm" onClick={handlePersist}>보관 요청하기</Button>}
      </section>

      {message && <p className="state-message">{message}</p>}
    </div>
  );
}

export default BackupPage;

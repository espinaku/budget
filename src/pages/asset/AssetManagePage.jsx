import {useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {getAssets, createAsset, updateAsset, reorderAssets, deactivateAsset, activateAsset} from "../../api/assetApi.js";
import AssetForm from "./AssetForm.jsx";
import Button from "../../components/common/Button.jsx";
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {getErrorMessage} from "../../api/errorMessage.js";
import TopBar from "../../components/common/TopBar.jsx";
import {SortableList, SortableItem} from "../../components/common/SortableList.jsx";
import {TYPE_LABEL} from "./assetLabels.js";

// 자산 등록·수정·잔액 보정·활성화. ?edit=id 로 진입하면 해당 자산 수정 폼을 연다
function AssetManagePage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editParam = Number(searchParams.get('edit')) || null;
  const [showForm, setShowForm] = useState(false); // 생성 폼 열림 여부
  const [editingId, setEditingId] = useState(editParam); // 수정 중인 행 id
  const [showInactive, setShowInactive] = useState(!!editParam); // 비활성 자산 포함 조회 여부 (편집 진입 시 대상이 보이도록 포함)

  const {data, isLoading, error} = useQuery({
    queryKey: ['assets', showInactive],
    queryFn: () => getAssets(showInactive)
  });

  // 이 3줄이 이번 step 핵심
  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['assets']}); // 목록 자동 재조회
      setShowForm(false);
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({id, payload}) => updateAsset(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['assets']});
      setEditingId(null);
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });

  const reorderMutation = useMutation({
    mutationFn: reorderAssets,
    onError: (error) => {
      alert(getErrorMessage(error));
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: ['assets']}); // 실패 시 서버 순서로 복구
    }
  });

  // 놓는 즉시 화면에 반영되도록 캐시를 먼저 바꾼 뒤 저장
  const handleReorder = (items) => {
    queryClient.setQueryData(['assets', showInactive], items);
    reorderMutation.mutate(items.map((x) => x.id));
  };

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['assets']});
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });

  const activateMutation = useMutation({
    mutationFn: (id) => activateAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['assets']});
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });



  // 체크카드 연결 계좌 후보: 활성 입출금 계좌 (자기 자신 제외)
  const bankOptions = (selfId) => (data ?? [])
    .filter((x) => x.type === 'BANK' && x.isActive && x.id !== selfId)
    .map((x) => ({value : x.id, label : x.name}));
  const assetNameOf = (id) => (data ?? []).find((x) => x.id === id)?.name ?? '-';
  return (
      <div className="page">
        <TopBar title="자산 관리" backTo="/settings" right={(
          <Button type="button" size="sm" onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}>추가</Button>
        )}/>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          비활성 자산 포함
        </label>
        {showForm && (
          <AssetForm
            bankOptions={bankOptions()}
            onSubmit={createMutation.mutate}
            onCancel={() => setShowForm(false)}
            submitting={createMutation.isPending}
          />
        )}
        {isLoading && <LoadingSpinner/>}
        {error && <p className="state-message is-error">에러: {error.message}</p>}

        {data && (data.length === 0 ? (
            <div className="empty-state">등록된 자산이 없습니다.</div>
        ) : (
            <SortableList items={data} onReorder={handleReorder}>
              {data.map((a) => (
                <SortableItem key={a.id} id={a.id} dragDisabled={editingId === a.id}
                    className={a.isActive && editingId !== a.id ? 'list-item--clickable' : ''}
                    onClick={() => {
                      if (a.isActive && editingId !== a.id) {
                        setShowForm(false);
                        setEditingId(a.id);
                      }
                    }}>
                  {editingId === a.id ? (
                    <AssetForm
                      initialValue={a}
                      bankOptions={bankOptions(a.id)}
                      onSubmit={(payload) => updateMutation.mutate({id : a.id, payload})}
                      onCancel={() => setEditingId(null)}
                      submitting={updateMutation.isPending}
                    />
                  ) : (
                  <>
                    <div className="list-item-main">
                      <span className="list-item-title">{a.name}</span>
                      <span className="badge">{TYPE_LABEL[a.type] ?? a.type}</span>
                      {a.type === 'CHECK_CARD' && (
                        <span className="list-item-meta">출금 계좌 {assetNameOf(a.linkedAssetId)}</span>
                      )}
                      {!a.isActive && <span className="list-item-meta">비활성</span>}
                    </div>
                    {a.balance != null && (
                        <span className="amount">{Number(a.balance).toLocaleString()}원</span>
                    )}
                    <div className="list-item-actions">
                      {a.isActive ? (
                        <Button type="button" variant="danger" size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`'${a.name}'을(를) 비활성할까요?`)) {
                                    deactivateMutation.mutate(a.id);
                                  }
                                }}>
                          비활성
                        </Button>
                      ) : (
                        <Button type="button" variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          activateMutation.mutate(a.id);
                        }}>
                          활성화
                        </Button>
                      )}
                    </div>
                  </>
                  )}
              </SortableItem>
              ))}
            </SortableList>
        ))}
      </div>
  );
}

export default AssetManagePage;

import {useState} from "react";
import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {createTransaction, deleteTransaction, searchTransactions, updateTransaction} from "../../api/transactionApi.js";
import {getAssets} from "../../api/assetApi.js";
import {getCategories} from "../../api/categoryApi.js";
import {getErrorMessage} from "../../api/errorMessage.js";
import Icon from "../../components/common/Icon.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ScrollLoader from "../../components/common/ScrollLoader.jsx";
import {formatDayHeader, formatShortDay} from "../../utils/month.js";
import {transferKind} from "../../utils/transfer.js";
import TransactionForm from "./TransactionForm.jsx";

const PAGE_SIZE = 30;
const won = (v) => `${Number(v).toLocaleString()}원`;
const TYPE_LABEL = {INCOME : '수입', EXPENSE : '지출', TRANSFER : '이체'};

// 정렬(날짜 내림차순)된 목록을 같은 날짜끼리 묶음
const groupByDate = (items) => {
  const groups = [];
  for (const tx of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.transactionDate) last.items.push(tx);
    else groups.push({date : tx.transactionDate, items : [tx]});
  }
  return groups;
};

// 거래 검색 결과 목록 (무한 스크롤 + 인라인 수정). 거래 화면과 자산 상세가 공용으로 사용
// props
//   filters            : 검색 파라미터 (빈 값은 넣지 않음)
//   variant            : 'feed'(거래 화면, 날짜 제목 + 아이콘 행) | 'ledger'(자산 상세, 날짜 칸 + 거래 후 잔액)
//   perspectiveAssetId : 이 자산 기준으로 이체 입금/출금을 구분 (없으면 이체는 방향 없이 표시)
//   groupWithMonth     : feed 날짜 제목에 월 포함 여부 (전체 기간 조회일 때 true)
//   showSummary        : 건수·합계 줄 표시 (feed 기본 true)
//   emptyMessage
//   showForm / onCloseForm / formInitial / formTitle : 추가 폼 (formInitial이 바뀌면 폼을 새로 시작)
function TransactionSearchList({
  filters, variant = 'feed', perspectiveAssetId, groupWithMonth = false,
  showSummary = variant === 'feed', emptyMessage = '조건에 맞는 거래가 없습니다.',
  showForm, onCloseForm, formInitial, formTitle,
}) {
  const queryClient = useQueryClient();
  const filtersKey = JSON.stringify(filters);
  const [editing, setEditing] = useState(null); // 열린 행 {id, filtersKey}, null = 닫힘

  // 조회 조건이 바뀌거나 추가 폼이 열리면 닫음 (그냥 숨기기만 하면 돌아왔을 때 다시 열려 있게 됨)
  if (editing && (showForm || editing.filtersKey !== filtersKey)) setEditing(null);
  const editingId = editing?.id ?? null;

  const {data, isLoading, error, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage} = useInfiniteQuery({
    queryKey : ['transactions', 'search', filters],
    queryFn : ({pageParam}) => searchTransactions({...filters, page : pageParam, size : PAGE_SIZE}),
    initialPageParam : 0,
    getNextPageParam : (last) => (last.hasNext ? last.page + 1 : undefined),
  });

  // 비활성 자산의 과거 거래도 이름이 보이도록 전체 조회
  const {data : assets} = useQuery({queryKey : ['assets', true], queryFn : () => getAssets(true)});
  const {data : categories} = useQuery({queryKey : ['categories'], queryFn : getCategories});
  const findAsset = (id) => (assets ?? []).find((a) => a.id === id);
  const findCategory = (id) => (categories ?? []).find((c) => c.id === id);
  const assetName = (id) => findAsset(id)?.name ?? '-';

  const invalidate = () => {
    queryClient.invalidateQueries({queryKey : ['transactions']});
    queryClient.invalidateQueries({queryKey : ['assets']});
  };
  const handleError = (e) => alert(getErrorMessage(e));

  const createMutation = useMutation({
    mutationFn : createTransaction,
    onSuccess : () => {
      invalidate();
      onCloseForm();
    },
    onError : handleError,
  });

  const updateMutation = useMutation({
    mutationFn : ({id, payload}) => updateTransaction(id, payload),
    onSuccess : () => {
      invalidate();
      setEditing(null);
    },
    onError : handleError,
  });

  const deleteMutation = useMutation({
    mutationFn : deleteTransaction,
    onSuccess : invalidate,
    onError : handleError,
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const groups = groupByDate(items);
  const first = data?.pages[0];
  const summary = first?.summary;

  // 이 자산(또는 필터 자산)으로 들어온 돈인지. 방향을 정할 수 없으면 null
  const isInbound = (tx) => {
    if (tx.type === 'INCOME') return true;
    if (tx.type === 'EXPENSE') return false;
    if (perspectiveAssetId == null) return null;
    return tx.toAssetId === perspectiveAssetId;
  };

  const startEdit = (tx) => {
    if (editingId === tx.id) return;
    onCloseForm?.();
    setEditing({id : tx.id, filtersKey});
  };

  const renderEditForm = (tx) => (
    <TransactionForm
      initialValue={tx}
      onSubmit={(payload) => updateMutation.mutate({id : tx.id, payload})}
      onCancel={() => setEditing(null)}
      onDelete={() => {
        if (window.confirm('이 거래를 삭제할까요?')) deleteMutation.mutate(tx.id);
      }}
      submitting={updateMutation.isPending}
    />
  );

  // ---- 피드 행 (토스형): 카테고리 아이콘 | 금액 + "내용 | 자산" ----
  const renderFeedRow = (tx) => {
    const isTransfer = tx.type === 'TRANSFER';
    const category = findCategory(tx.categoryId);
    const inbound = isInbound(tx);
    const sign = inbound == null ? '' : (inbound ? '+' : '-');
    const amountClass = inbound == null ? ' is-transfer' : (inbound ? ' is-in' : '');
    const color = category?.color;
    const iconStyle = {
      background : color ? `color-mix(in srgb, ${color} 18%, transparent)` : 'var(--color-bg)',
      color : color ?? 'var(--color-text-muted)',
    };

    let sub;
    if (isTransfer) {
      const memo = tx.memo || transferKind(findAsset(tx.toAssetId));
      sub = `${memo} | ${assetName(tx.assetId)} → ${assetName(tx.toAssetId)}`;
    } else {
      const title = tx.memo || category?.name || TYPE_LABEL[tx.type];
      const tag = tx.tagName ? ` #${tx.tagName}` : '';
      sub = `${title}${tag}${tx.assetId ? ` | ${assetName(tx.assetId)}` : ''}`;
    }

    return (
      <li key={tx.id} className="tx-row" onClick={() => startEdit(tx)}>
        <span className="tx-icon" style={iconStyle}>
          {isTransfer ? <Icon name="transfer" size={20}/> : (category?.icon || '📦')}
        </span>
        <div className="tx-main">
          <span className={`tx-amount${amountClass}`}>{sign}{won(tx.amount)}</span>
          <span className="tx-sub">{sub}</span>
        </div>
      </li>
    );
  };

  // ---- 원장 행 (카카오뱅크형): 날짜 | 내용 | 금액 + 거래 후 잔액 ----
  const renderLedgerRow = (tx, showDate) => {
    const isTransfer = tx.type === 'TRANSFER';
    const category = findCategory(tx.categoryId);
    const inbound = isInbound(tx) ?? false;
    const title = tx.memo || (isTransfer ? transferKind(findAsset(tx.toAssetId)) : (category?.name ?? TYPE_LABEL[tx.type]));

    let sub;
    if (isTransfer) {
      sub = inbound ? `${assetName(tx.assetId)}에서 이체` : `${assetName(tx.toAssetId)}(으)로 이체`;
    } else {
      // 이 계좌에 연결된 체크카드로 쓴 거래면 카드 이름을 앞에 표시
      const viaCard = perspectiveAssetId != null && tx.assetId !== perspectiveAssetId ? assetName(tx.assetId) : null;
      sub = [viaCard, tx.memo ? category?.name : null, tx.tagName ? `#${tx.tagName}` : null]
        .filter(Boolean).join(' · ') || TYPE_LABEL[tx.type];
    }

    return (
      <li key={tx.id} className="ledger-row" onClick={() => startEdit(tx)}>
        <span className="ledger-date">{showDate ? formatShortDay(tx.transactionDate) : ''}</span>
        <div className="ledger-main">
          <span className="ledger-title">{title}</span>
          <span className="ledger-sub">{sub}</span>
        </div>
        <div className="ledger-amounts">
          <span className={`ledger-amount${inbound ? ' is-in' : ''}`}>{inbound ? '' : '-'}{won(tx.amount)}</span>
          {tx.balanceAfter != null && <span className="ledger-balance">{won(tx.balanceAfter)}</span>}
        </div>
      </li>
    );
  };

  const renderEditingRow = (tx, className) => (
    <li key={tx.id} className={`${className} is-editing`}>{renderEditForm(tx)}</li>
  );

  return (
    <>
      {showForm && (
        <TransactionForm
          key={JSON.stringify(formInitial ?? {})}
          initialValue={formInitial}
          title={formTitle}
          onSubmit={(payload) => createMutation.mutate(payload)}
          onCancel={onCloseForm}
          submitting={createMutation.isPending}
        />
      )}

      {isLoading && <LoadingSpinner/>}
      {error && <p className="state-message is-error">에러: {error.message}</p>}

      {showSummary && first && first.totalCount > 0 && (
        <div className="tx-summary">
          <span>{first.totalCount.toLocaleString()}건</span>
          {summary.income > 0 && <span className="is-in">수입 +{summary.income.toLocaleString()}</span>}
          {summary.expense > 0 && <span>지출 -{summary.expense.toLocaleString()}</span>}
          {perspectiveAssetId != null && (summary.transferIn > 0 || summary.transferOut > 0) && (
            <span>이체 +{summary.transferIn.toLocaleString()} / -{summary.transferOut.toLocaleString()}</span>
          )}
        </div>
      )}

      {first && items.length === 0 && <div className="empty-state">{emptyMessage}</div>}

      {items.length > 0 && variant === 'feed' && (
        <div className="tx-feed">
          {groups.map((g) => (
            <section key={g.date}>
              <h2 className="tx-day-header">{formatDayHeader(g.date, groupWithMonth)}</h2>
              <ul className="tx-day-list">
                {g.items.map((tx) => (editingId === tx.id ? renderEditingRow(tx, 'tx-row') : renderFeedRow(tx)))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {items.length > 0 && variant === 'ledger' && (
        <ul className="ledger">
          {groups.flatMap((g) => g.items.map((tx, i) => (
            editingId === tx.id ? renderEditingRow(tx, 'ledger-row') : renderLedgerRow(tx, i === 0)
          )))}
        </ul>
      )}

      <ScrollLoader hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage}
                    isFetchNextPageError={isFetchNextPageError} fetchNextPage={fetchNextPage}/>
    </>
  );
}

export default TransactionSearchList;

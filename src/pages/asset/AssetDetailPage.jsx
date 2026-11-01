import {useEffect, useMemo, useState} from "react";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {getAsset, getAssetUsage, getAssets} from "../../api/assetApi.js";
import Icon from "../../components/common/Icon.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import TopBar from "../../components/common/TopBar.jsx";
import {getCurrentMonth} from "../../utils/month.js";
import TransactionSearchList from "../transaction/TransactionSearchList.jsx";
import {TYPE_LABEL, isCardType} from "./assetLabels.js";

const DIRECTION_OPTIONS = [
  {value : '', label : '전체'},
  {value : 'IN', label : '입금'},
  {value : 'OUT', label : '출금'},
];

const KEYWORD_DELAY_MS = 300;

// 자산 상세 (카카오뱅크 통장형): 잔액 | 입금/출금 필터·검색 | 날짜별 원장(거래 후 잔액) | 하단 버튼
function AssetDetailPage() {
  const navigate = useNavigate();
  const {id} = useParams();
  const assetId = Number(id);
  const [params, setParams] = useSearchParams();

  const direction = params.get('direction') ?? '';
  const keyword = params.get('q') ?? '';
  const [searchOpen, setSearchOpen] = useState(!!keyword);
  const [keywordDraft, setKeywordDraft] = useState(keyword);
  const [formAction, setFormAction] = useState(null); // 누른 하단 버튼 {label, title, initial}, null = 추가 폼 닫힘

  const currentMonth = getCurrentMonth();
  const monthNumber = Number(currentMonth.slice(5));

  const updateParams = (changes) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      return next;
    }, {replace : true});
  };

  useEffect(() => {
    const value = keywordDraft.trim();
    if (value === keyword) return;
    const timer = setTimeout(() => updateParams({q : value}), KEYWORD_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordDraft]);

  const {data : asset, isLoading, error} = useQuery({
    queryKey : ['assets', 'detail', assetId],
    queryFn : () => getAsset(assetId),
  });

  const {data : usageData} = useQuery({
    queryKey : ['assets', 'usage', currentMonth],
    queryFn : () => getAssetUsage(currentMonth),
  });
  const usage = (usageData ?? []).find((u) => u.assetId === assetId);

  // 체크카드의 출금 계좌 이름 표시용 (목록 화면과 같은 queryKey)
  const {data : allAssets} = useQuery({queryKey : ['assets', true], queryFn : () => getAssets(true)});

  // 기간 제한 없이 이 자산의 전체 거래 (통장 내역처럼 계속 스크롤)
  const filters = useMemo(() => {
    const result = {assetId};
    if (direction) result.direction = direction;
    if (keyword) result.keyword = keyword;
    return result;
  }, [assetId, direction, keyword]);

  const goBack = () => navigate('/assets');

  if (isLoading) return <LoadingSpinner/>;
  if (error) {
    return (
      <div className="page">
        <TopBar title="자산" onBack={goBack}/>
        <p className="state-message is-error">에러: {error.message}</p>
      </div>
    );
  }

  const isCard = isCardType(asset.type);
  const isCheckCard = asset.type === 'CHECK_CARD';
  const linkedName = (allAssets ?? []).find((a) => a.id === asset.linkedAssetId)?.name ?? '-';
  const openForm = (action) => {
    setFormAction(action);
    window.scrollTo({top : 0, behavior : 'smooth'});
  };

  // 하단 버튼. 같은 추가 폼을 열되 미리 채우는 값과 폼 제목이 다름
  //   통장·현금 : 수입·지출 기록(자산 고정) / 이체(출금 = 이 자산)
  //   신용카드  : 사용 기록(자산 고정) / 대금 납부(입금 = 이 카드, 출금 계좌만 고르면 됨)
  //   체크카드  : 사용 기록만 (대금 없음, 연결 계좌에서 바로 빠짐)
  const actions = isCheckCard
    ? [{label : '사용 기록', title : `${asset.name} 사용 기록`, initial : {assetId}}]
    : isCard
    ? [
      {label : '사용 기록', title : `${asset.name} 사용 기록`, initial : {assetId}},
      {label : '대금 납부', title : `${asset.name} 대금 납부`,
        initial : {type : 'TRANSFER', toAssetId : assetId}, primary : true},
    ]
    : [
      {label : '수입·지출 기록', title : `${asset.name} 수입·지출 기록`, initial : {assetId}},
      {label : '이체', title : `${asset.name}에서 보내기`,
        initial : {type : 'TRANSFER', assetId}, primary : true},
    ];

  const directionLabel = DIRECTION_OPTIONS.find((o) => o.value === direction)?.label ?? '전체';

  return (
    <div className="page asset-detail">
      <TopBar
        title={asset.name}
        onBack={goBack}
        right={(
          <button type="button" className="icon-btn" aria-label="자산 편집"
                  onClick={() => navigate(`/settings/assets?edit=${assetId}`)}>
            <Icon name="gear"/>
          </button>
        )}
      />

      <section className="asset-hero">
        <span className="asset-hero-label">
          {TYPE_LABEL[asset.type] ?? asset.type}{!asset.isActive && ' · 비활성'}
        </span>
        {isCard ? (
          <>
            <strong className="asset-hero-value">{(usage?.expense ?? 0).toLocaleString()}원</strong>
            <span className="asset-hero-sub">
              {isCheckCard
                ? `${monthNumber}월 사용액 · 출금 계좌 ${linkedName}`
                : `${monthNumber}월 사용액 · 납부 ${(usage?.transferIn ?? 0).toLocaleString()}원`}
            </span>
          </>
        ) : (
          <strong className="asset-hero-value">
            {asset.balance != null ? `${Number(asset.balance).toLocaleString()}원` : '-'}
          </strong>
        )}
      </section>

      <section className="ledger-card">
        <div className="ledger-toolbar">
          <label className="dropdown-select">
            {directionLabel}
            <Icon name="chevronDown" size={18}/>
            <select aria-label="입출금 구분" value={direction}
                    onChange={(e) => updateParams({direction : e.target.value})}>
              {DIRECTION_OPTIONS.map((o) => <option key={o.value || 'ALL'} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" aria-label="메모 검색" aria-pressed={searchOpen}
                  className={`icon-btn icon-btn--outline${searchOpen || keyword ? ' is-active' : ''}`}
                  onClick={() => setSearchOpen((v) => !v)}>
            <Icon name="search" size={20}/>
          </button>
        </div>

        {searchOpen && (
          <input className="input search-input ledger-search" type="search" placeholder="메모 검색"
                 value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)} autoFocus/>
        )}

        <TransactionSearchList
          filters={filters}
          variant="ledger"
          perspectiveAssetId={assetId}
          showSummary={false}
          emptyMessage={direction || keyword ? '조건에 맞는 거래가 없습니다.' : '아직 거래 내역이 없습니다.'}
          showForm={!!formAction}
          onCloseForm={() => setFormAction(null)}
          formInitial={formAction?.initial}
          formTitle={formAction?.title}
        />
      </section>

      {asset.isActive && (
        <div className={`action-bar${actions.length === 1 ? ' action-bar--single' : ''}`}>
          {actions.map((a) => (
            <button key={a.label} type="button" className={`action-btn${a.primary ? ' is-primary' : ''}`}
                    onClick={() => openForm(a)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AssetDetailPage;

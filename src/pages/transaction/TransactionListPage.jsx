import {useEffect, useMemo, useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {getAssets} from "../../api/assetApi.js";
import {getCategories} from "../../api/categoryApi.js";
import {getTags} from "../../api/tagApi.js";
import {getDailySums} from "../../api/transactionApi.js";
import FilterChip from "../../components/common/FilterChip.jsx";
import Icon from "../../components/common/Icon.jsx";
import MonthSwitcher from "../../components/common/MonthSwitcher.jsx";
import {ALL_MONTHS, formatDayHeader, getCurrentMonth, monthRange} from "../../utils/month.js";
import {inAssetTab} from "../asset/assetLabels.js";
import DayCalendar from "./DayCalendar.jsx";
import TransactionSearchList from "./TransactionSearchList.jsx";

const TYPE_OPTIONS = [
  {value : 'EXPENSE', label : '지출'},
  {value : 'INCOME', label : '수입'},
  {value : 'TRANSFER', label : '이체'},
];

// 자산 종류 탭. 입출금 = 계좌·체크카드 수입·지출 + 모든 이체, 신용카드·현금·투자 탭은 그 자산의 수입·지출만
const TRANSFER_TABS = ['', 'BANK'];
const ASSET_TABS = [
  {value : '', label : '전체'},
  {value : 'CARD', label : '신용카드'},
  {value : 'BANK', label : '입출금'},
  {value : 'CASH', label : '현금'},
  {value : 'INVESTMENT', label : '투자'},
];

const KEYWORD_DELAY_MS = 300;

// 거래 화면 (토스형): 월 | 자산 종류 탭 | 일별 달력 | 날짜별 목록
// 필터 상태는 URL 쿼리스트링 (뒤로가기·새로고침 유지, 대시보드 링크 진입)
function TransactionListPage() {
  const [params, setParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);

  const month = params.get('month') || getCurrentMonth();
  const day = params.get('day') ?? '';
  const assetType = params.get('assetType') ?? '';
  const type = params.get('type') ?? '';
  const assetId = params.get('assetId') ?? '';
  const categoryId = params.get('categoryId') ?? '';
  const tagId = params.get('tagId') ?? '';
  const keyword = params.get('q') ?? '';

  const activeFilterCount = [type, assetId, categoryId, tagId, keyword].filter(Boolean).length;
  const [panelOpen, setPanelOpen] = useState(activeFilterCount > 0);
  const [keywordDraft, setKeywordDraft] = useState(keyword);

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

  // 메모 검색어는 입력이 멈춘 뒤 URL에 반영
  useEffect(() => {
    const value = keywordDraft.trim();
    if (value === keyword) return;
    const timer = setTimeout(() => updateParams({q : value}), KEYWORD_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordDraft]);

  // 달력용(기간 = 그 달 전체)과 목록용(날짜를 고르면 그날만) 조건
  const baseFilters = useMemo(() => {
    const result = {};
    if (assetType) result.assetType = assetType;
    if (type) result.type = type;
    if (assetId) result.assetId = Number(assetId);
    if (categoryId) result.categoryId = Number(categoryId);
    if (tagId) result.tagId = Number(tagId);
    if (keyword) result.keyword = keyword;
    return result;
  }, [assetType, type, assetId, categoryId, tagId, keyword]);

  const isAllPeriod = month === ALL_MONTHS;
  const listFilters = useMemo(() => {
    if (day) return {...baseFilters, from : day, to : day};
    return isAllPeriod ? baseFilters : {...baseFilters, ...monthRange(month)};
  }, [baseFilters, day, month, isAllPeriod]);

  const calendarFilters = useMemo(
    () => (isAllPeriod ? null : {...baseFilters, ...monthRange(month)}),
    [baseFilters, month, isAllPeriod]
  );

  const {data : dailySums} = useQuery({
    queryKey : ['transactions', 'daily', calendarFilters],
    queryFn : () => getDailySums(calendarFilters),
    enabled : !!calendarFilters,
  });

  const {data : assets} = useQuery({queryKey : ['assets', true], queryFn : () => getAssets(true)});
  const {data : categories} = useQuery({queryKey : ['categories'], queryFn : getCategories});
  const {data : tags} = useQuery({
    queryKey : ['tags', categoryId ? Number(categoryId) : 'ALL'],
    queryFn : () => getTags(categoryId ? Number(categoryId) : undefined),
  });

  const toOptions = (list) => (list ?? []).map((x) => ({value : x.id, label : x.name}));
  const assetOptions = toOptions((assets ?? []).filter((a) => inAssetTab(a.type, assetType)));
  const showsTransfer = TRANSFER_TABS.includes(assetType);
  const typeOptions = showsTransfer ? TYPE_OPTIONS : TYPE_OPTIONS.filter((o) => o.value !== 'TRANSFER');

  // 이체에는 카테고리·태그가 없으므로 해당 필터를 함께 해제
  const handleType = (value) => {
    updateParams(value === 'TRANSFER' ? {type : value, categoryId : '', tagId : ''} : {type : value});
  };

  // 카테고리가 바뀌면 이전 카테고리의 태그는 유효하지 않음
  const handleCategory = (value) => updateParams({categoryId : value, tagId : ''});

  // 태그를 고르면 소속 카테고리도 함께 설정
  const handleTag = (value) => {
    const tag = (tags ?? []).find((t) => String(t.id) === value);
    updateParams(tag ? {tagId : value, categoryId : String(tag.categoryId)} : {tagId : value});
  };

  // 다른 종류 탭의 자산이 선택돼 있으면 결과가 비므로 함께 해제. 이체가 없는 탭이면 "이체" 종류 필터도 해제
  const handleAssetTab = (value) => {
    const changes = {assetType : value, assetId : ''};
    if (type === 'TRANSFER' && !TRANSFER_TABS.includes(value)) changes.type = '';
    updateParams(changes);
  };

  const openForm = () => {
    setShowForm(true);
    window.scrollTo({top : 0, behavior : 'smooth'});
  };

  return (
    <div className="page">
      <div className="tx-page-top">
        <MonthSwitcher value={month} allowAll onChange={(value) => updateParams({month : value, day : ''})}/>
        <div className="icon-actions">
          <button type="button" aria-label="검색·필터" aria-pressed={panelOpen}
                  className={`icon-btn${panelOpen || activeFilterCount > 0 ? ' is-active' : ''}`}
                  onClick={() => setPanelOpen((v) => !v)}>
            <Icon name="search"/>
          </button>
          {/* 데스크톱용. 모바일은 하단 탭 위 플로팅 버튼(.fab)을 쓰고 이 버튼은 CSS로 숨김 */}
          <button type="button" className="icon-btn icon-btn--primary tx-add-top" aria-label="거래 추가" onClick={openForm}>
            <Icon name="plus"/>
          </button>
        </div>
      </div>

      <div className="segment-tabs" role="tablist">
        {ASSET_TABS.map((tab) => (
          <button key={tab.value || 'ALL'} type="button" role="tab"
                  aria-selected={assetType === tab.value}
                  className={`segment-tab${assetType === tab.value ? ' is-active' : ''}`}
                  onClick={() => handleAssetTab(tab.value)}>
            {tab.label}
          </button>
        ))}
      </div>

      {(panelOpen || activeFilterCount > 0) && (
        <div className="filter-panel">
          {panelOpen && (
            <input className="input search-input" type="search" placeholder="메모 검색"
                   value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)}/>
          )}
          <div className="filter-chips">
            <FilterChip label="종류" value={type} options={typeOptions} onChange={handleType}/>
            <FilterChip label="자산" value={assetId} options={assetOptions}
                        onChange={(value) => updateParams({assetId : value})}/>
            {type !== 'TRANSFER' && (
              <>
                <FilterChip label="카테고리" value={categoryId} options={toOptions(categories)} onChange={handleCategory}/>
                <FilterChip label="태그" value={tagId} options={toOptions(tags)} onChange={handleTag}/>
              </>
            )}
          </div>
        </div>
      )}

      {!isAllPeriod && (
        <DayCalendar month={month} sums={dailySums} selected={day}
                     onSelect={(value) => updateParams({day : value})}/>
      )}

      {day && (
        <div className="filter-chips day-filter">
          <span className="filter-chip is-active">
            <span className="filter-chip-label">{formatDayHeader(day, true)}</span>
            <button type="button" className="filter-chip-clear" aria-label="날짜 선택 해제"
                    onClick={() => updateParams({day : ''})}><Icon name="close" size={13}/></button>
          </span>
        </div>
      )}

      <TransactionSearchList
        filters={listFilters}
        variant="feed"
        perspectiveAssetId={assetId ? Number(assetId) : undefined}
        groupWithMonth={isAllPeriod}
        showForm={showForm}
        onCloseForm={() => setShowForm(false)}
      />

      {/* 모바일 전용 거래 추가 버튼: 하단 탭 바 위에 고정 (거래 화면에서만, 폼이 열려 있으면 숨김) */}
      {!showForm && (
        <button type="button" className="fab" aria-label="거래 추가" onClick={openForm}>
          <Icon name="plus" size={26}/>
        </button>
      )}
    </div>
  );
}

export default TransactionListPage;

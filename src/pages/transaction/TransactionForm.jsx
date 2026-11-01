import {useEffect, useMemo, useRef, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {getCategories} from "../../api/categoryApi.js";
import {getAssets} from "../../api/assetApi.js";
import {getTags} from "../../api/tagApi.js";
import {getSuggestions} from "../../api/transactionApi.js";
import Button from "../../components/common/Button.jsx";
import Select from "../../components/common/Select.jsx";
import Input from "../../components/common/Input.jsx";
import FormField from "../../components/common/FormField.jsx";
import {digitLengthError} from "../../utils/validation.js";
import {isCardType} from "../asset/assetLabels.js";
import {parseTransactionText, todayLocal, toLocalDate} from "../../utils/parseTransactionText.js";

const TYPE_OPTIONS = [
  {value : 'EXPENSE', label : '지출'},
  {value : 'INCOME', label : '수입'},
  {value : 'TRANSFER', label : '이체'},
];

const AMOUNT_MAX_DIGITS = 15; // DB amount는 BIGINT지만 JS Number 정밀도 한계에 맞춰 제한
const MEMO_MAX_LENGTH = 100; // DB memo 컬럼 varchar(100)
const QUICK_TEXT_MAX_LENGTH = 200; // 한 줄 입력 최대 길이
const SUGGEST_MIN_LENGTH = 2; // 이 글자 수 미만의 메모는 추천하지 않음
const SUGGEST_DELAY_MS = 350; // 입력이 멈춘 뒤 추천을 조회하기까지의 대기 시간
const TYPE_LABEL = {EXPENSE : '지출', INCOME : '수입', TRANSFER : '이체'};
const TYPE_CYCLE = ['EXPENSE', 'INCOME', 'TRANSFER'];

const hintStyle = {fontSize:13, color:'var(--color-text-muted)', margin:'4px 0 0'};

const EMPTY = {
  categoryId : '',
  assetId : '',
  tagId : '',
  type : 'EXPENSE',
  amount : '',
  memo : '',
  transactionDate : todayLocal(),
  toAssetId: '',
};

// 오늘/어제는 글자로, 그 외는 M/D 로 표시
const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dateStr === toLocalDate(now)) return '오늘';
  if (dateStr === toLocalDate(yesterday)) return '어제';
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
};

// props
//   initialValue : 수정 시 기존 transaction 객체, 생성 시 undefined
//   onSubmit     : (payload) => void
//   onCancel     : () => void
//   onDelete     : () => void  (수정 시에만 전달, 생성 폼에서는 없음)
//   submitting   : boolean
//   title        : 폼 맨 위 제목 (선택, 자산 상세 버튼에서 어떤 동작인지 표시)
//
// 생성 폼 : 한 줄 입력("어제 스벅 4500 삼성카드 #카페") → 규칙 파서 + 메모 기반 추천으로 항목 자동 세팅.
//           틀리면 "상세 편집"으로 모든 항목을 직접 수정. 수정 폼은 항상 상세 항목 그대로 표시.
function TransactionForm({initialValue, onSubmit, onCancel, onDelete, submitting, title}) {
  const isEdit = !!initialValue?.id;
  const quickMode = !isEdit;

  const [form, setForm] = useState({...EMPTY, ...initialValue});
  const [amountError, setAmountError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [quickText, setQuickText] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [quickSuggestion, setQuickSuggestion] = useState(null); // {memo, data}
  const [assetError, setAssetError] = useState('');
  // 사용자가 직접 고른 필드는 입력 줄의 자동 해석이 덮어쓰지 않음
  // 자산 상세에서 추가할 때 미리 정한 값(자산, 이체 종류·방향)은 입력 줄 해석이 바꾸지 않음
  const presetKeys = isEdit ? [] : Object.entries(initialValue ?? {})
    .filter(([, value]) => value != null && value !== '')
    .map(([key]) => key);
  const manualRef = useRef(new Set(presetKeys));

  const showDetail = isEdit || detailOpen;

  const {data : categories} = useQuery({
    queryKey : ['categories'],
    queryFn : getCategories
  });

  const {data : assets} = useQuery({
    queryKey : ['assets'],
    queryFn : () => getAssets()
  });

  // 카테고리가 선택된 경우에만 그 카테고리의 태그 목록 조회 (상세 편집의 태그 select용)
  const {data : tags} = useQuery({
    queryKey : ['tags', form.categoryId],
    queryFn : () => getTags(form.categoryId),
    enabled : !!form.categoryId
  });

  // 한 줄 입력 해석용 전체 태그 (Tag 페이지의 "전체" 조회와 같은 queryKey)
  const {data : allTags} = useQuery({
    queryKey : ['tags', 'ALL'],
    queryFn : () => getTags(),
    enabled : quickMode
  });

  // ------ 한 줄 입력 해석 (생성 폼) ---------
  const parsed = useMemo(
    () => parseTransactionText(quickText, {assets : assets ?? [], tags : allTags ?? [], categories : categories ?? []}),
    [quickText, assets, allTags, categories]
  );

  // 메모가 정해지면 과거 이력 기반 추천 조회 (입력이 멈춘 뒤)
  useEffect(() => {
    if (!quickMode) return;
    const memo = parsed.memo;
    if (memo.length < SUGGEST_MIN_LENGTH) {
      setQuickSuggestion(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      getSuggestions(memo)
        .then((data) => {
          if (!cancelled) setQuickSuggestion({memo, data : data.matchedCount > 0 ? data : null});
        })
        .catch(() => {}); // 추천은 보조 기능이므로 실패해도 무시
    }, SUGGEST_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [quickMode, parsed.memo]);

  // 해석 결과 + 추천을 폼 값에 반영 (직접 고른 필드는 유지)
  useEffect(() => {
    if (!quickMode) return;
    const sugg = quickSuggestion && quickSuggestion.memo === parsed.memo ? quickSuggestion.data : null;
    const topTag = sugg?.tags?.[0];
    const topCategory = sugg?.categories?.[0];
    const topAsset = sugg?.assets?.[0];

    let categoryId = parsed.categoryId;
    let tagId = parsed.tagId;
    if (tagId == null) {
      if (categoryId == null) {
        tagId = topTag?.id ?? null;
        categoryId = topTag?.categoryId ?? topCategory?.id ?? null;
      } else if (topTag && topTag.categoryId === categoryId) {
        tagId = topTag.id;
      }
    }
    // 이체 출금 추천은 카드와 입금 자산을 제외한 첫 자산
    const isCard = (id) => isCardType((assets ?? []).find((a) => a.id === id)?.type);
    const suggestedAsset = parsed.type === 'TRANSFER'
      ? sugg?.assets?.find((a) => !isCard(a.id) && a.id !== parsed.toAssetId)
      : topAsset;
    const assetId = parsed.assetId ?? suggestedAsset?.id ?? null;

    setForm((prev) => {
      const manual = manualRef.current;
      const pick = (name, value) => (manual.has(name) ? prev[name] : value);
      return {
        ...prev,
        type : pick('type', parsed.type),
        amount : pick('amount', parsed.amount ?? ''),
        transactionDate : pick('transactionDate', parsed.date ?? todayLocal()),
        memo : pick('memo', parsed.memo),
        categoryId : pick('categoryId', categoryId ?? ''),
        // 카테고리만 직접 바꾼 경우 자동 태그는 그 카테고리와 맞지 않을 수 있어 비움
        tagId : pick('tagId', manual.has('categoryId') ? '' : (tagId ?? '')),
        assetId : pick('assetId', assetId ?? ''),
        toAssetId: pick('toAssetId', parsed.toAssetId ?? ''),
      };
    });
  }, [quickMode, parsed, quickSuggestion, assets]);

  const handleQuickChange = (e) => {
    const value = e.target.value;
    setQuickText(value);
    setAmountError('');
    setCategoryError('');
    setAssetError('');
    if (!value.trim()) {
      manualRef.current.clear();
      presetKeys.forEach((key) => manualRef.current.add(key));
    }
  };

  // ---- 칩 / 빠른 선택 ----
  const toggleType = () => {
    manualRef.current.add('type');
    setForm((prev) => ({
      ...prev,
      type: TYPE_CYCLE[(TYPE_CYCLE.indexOf(prev.type) + 1) % TYPE_CYCLE.length]}));
  };

  const pickCategory = (value) => {
    manualRef.current.add('categoryId');
    setForm((prev) => ({...prev, categoryId : value, tagId : ''}));
    setCategoryError('');
  };

  const pickTag = (tag) => {
    // 태그를 고르면 소속 카테고리도 함께 결정
    manualRef.current.add('tagId');
    manualRef.current.add('categoryId');
    setForm((prev) => ({...prev, tagId : tag.id, categoryId : tag.categoryId}));
    setCategoryError('');
  };

  // ---- 상세 편집 (공통) ----
  const handleChange = (e) => {
    const {name, value} = e.target;
    manualRef.current.add(name);
    setForm((prev) => {
      const next = {...prev, [name] : value};
      // 카테고리를 바꾸면 이전 카테고리의 태그 선택은 더 이상 유효하지 않으므로 초기화
      if (name === 'categoryId') {
        next.tagId = '';
      }
      return next;
    });
    if (name === 'amount') setAmountError('');
    if (name === 'categoryId') setCategoryError('');
    if (name === 'assetId' || name === 'toAssetId') setAssetError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const isTransfer = form.type === 'TRANSFER';

    if (!isTransfer && !form.categoryId) {
      setCategoryError('카테고리를 선택해주세요.');
      return;
    }

    if (isTransfer) {
      const fromAsset = (assets ?? []).find((a) => String(a.id) === String(form.assetId));
      if (!form.assetId || !form.toAssetId) {
        setAssetError('출금 자산과 입금 자산을 선택해주세요.');
        return;
      }
      if (String(form.assetId) === String(form.toAssetId)) {
        setAssetError('출금 자산과 입금 자산은 서로 달라야 합니다.');
        return;
      }
      if (isCardType(fromAsset?.type)) {
        setAssetError('카드는 출금 자산으로 선택할 수 없습니다.');
        return;
      }
      const toAsset = (assets ?? []).find((a) => String(a.id) === String(form.toAssetId));
      if (toAsset?.type === 'CHECK_CARD') {
        setAssetError('체크카드는 입금 자산으로 선택할 수 없습니다.');
        return;
      }
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setAmountError('금액을 입력해주세요.');
      return;
    }

    const amountDigitError = digitLengthError(form.amount, AMOUNT_MAX_DIGITS, '금액');
    if (amountDigitError) {
      setAmountError(amountDigitError);
      return;
    }

    const payload = {
      categoryId: isTransfer ? null : Number(form.categoryId),
      assetId: form.assetId ? Number(form.assetId) : null,
      toAssetId: isTransfer ? Number(form.toAssetId) : null,
      tagId : !isTransfer && form.tagId ? Number(form.tagId) : null,
      type : form.type,
      amount: Number(form.amount),
      memo : form.memo,
      transactionDate: form.transactionDate,
    };
    onSubmit(payload);
  };

  const categoryOptions = (categories ?? []).map((c) => ({value : c.id, label : c.name}));
  const assetOptions = (assets ?? []).map((a) => ({value : a.id, label : a.name}));
  const fromAssetOptions = (assets ?? []).filter((a) => !isCardType(a.type)).map((a) => ({value : a.id, label : a.name}));
  // 체크카드는 대금이 없어 입금 자산이 될 수 없음
  const toAssetOptions = (assets ?? [])
    .filter((a) => a.type !== 'CHECK_CARD' && String(a.id) !== String(form.assetId))
    .map((a) => ({value : a.id, label : a.name}));
  const tagOptions = (tags ?? []).map((t) => ({value : t.id, label : t.name}));

  // 칩 표시용 이름 조회 (select 값은 문자열일 수 있어 문자열로 비교)
  const findName = (list, id) => (list ?? []).find((x) => String(x.id) === String(id))?.name;
  const assetName = form.assetId ? findName(assets, form.assetId) : null;
  const categoryName = form.categoryId ? findName(categories, form.categoryId) : null;
  const tagName = form.tagId ? findName(allTags, form.tagId) : null;
  const isTransfer = form.type === 'TRANSFER';

  // 추천 대안 태그 (현재 선택된 태그 제외, 최대 3개)
  const altTags = quickMode && quickSuggestion && quickSuggestion.memo === parsed.memo && quickSuggestion.data
    ? quickSuggestion.data.tags.filter((t) => String(t.id) !== String(form.tagId)).slice(0, 3)
    : [];

  return (
    <form onSubmit={handleSubmit} className="form-card">
      {title && <h3 className="form-title">{title}</h3>}
      {quickMode && (
        <div className="quick-entry">
          <div className="quick-input-row">
            <Input
              value={quickText}
              onChange={handleQuickChange}
              placeholder="예: 어제 스벅 4500 삼성카드 #카페"
              maxLength={QUICK_TEXT_MAX_LENGTH}
              enterKeyHint="done"
              autoFocus
            />
          </div>

          {!detailOpen && (
            <>
              <div className="quick-chips">
                <button type="button" className={`chip chip--${form.type.toLowerCase()}`}
                        onClick={toggleType} title="누르면 지출/수입/이체 전환">
                  {TYPE_LABEL[form.type]}
                </button>
                <button type="button" className={`chip${form.amount ? '' : ' chip--missing'}`}
                        onClick={() => setDetailOpen(true)}>
                  {form.amount ? `${Number(form.amount).toLocaleString()}원` : '금액 없음'}
                </button>
                <button type="button" className="chip" onClick={() => setDetailOpen(true)}>
                  {formatShortDate(form.transactionDate)}
                </button>
                {!isTransfer && assetName && (
                  <button type="button" className="chip" onClick={() => setDetailOpen(true)}>{assetName}</button>
                )}
                {!isTransfer && categoryName && (
                  <button type="button" className="chip" onClick={() => setDetailOpen(true)}>{categoryName}</button>
                )}
                {!isTransfer && tagName && (
                  <button type="button" className="chip" onClick={() => setDetailOpen(true)}>#{tagName}</button>
                )}
              </div>

              {amountError && <span className="form-field-error">{amountError}</span>}

              {isTransfer && (
                <div className="form-row">
                  <FormField label="출금 자산">
                    <Select name="assetId" options={fromAssetOptions} value={form.assetId ?? ''}
                            onChange={handleChange} placeholder="선택하세요" />
                  </FormField>
                  <FormField label="입금 자산" error={assetError}>
                    <Select name="toAssetId" options={toAssetOptions} value={form.toAssetId ?? ''}
                            onChange={handleChange} placeholder="선택하세요" />
                  </FormField>
                </div>
              )}

              {!isTransfer && !form.categoryId && (
                <FormField error={categoryError}>
                  <Select
                    options={categoryOptions}
                    value={form.categoryId}
                    onChange={(e) => pickCategory(e.target.value)}
                    placeholder="카테고리 선택 (필수)"
                  />
                </FormField>
              )}

              {!isTransfer && altTags.length > 0 && (
                <div className="quick-chips">
                  <span className="quick-alt-label">다른 태그</span>
                  {altTags.map((t) => (
                    <button key={t.id} type="button" className="chip chip--alt" onClick={() => pickTag(t)}>
                      #{t.name} ({t.count})
                    </button>
                  ))}
                </div>
              )}

              {!quickText.trim() && (
                <p style={hintStyle}>금액·날짜·자산·#태그를 한 줄에 적으면 자동으로 채워집니다.</p>
              )}
            </>
          )}

          <button type="button" className="quick-toggle" onClick={() => setDetailOpen((v) => !v)}>
            {detailOpen ? '간단히 보기 ▴' : '상세 편집 ▾'}
          </button>
        </div>
      )}

      {showDetail && (
        <div className={quickMode ? 'quick-detail' : undefined}>
          <div className="form-row">
            <FormField label="종류">
              <Select name="type" options={TYPE_OPTIONS} value={form.type} onChange={handleChange} />
            </FormField>
            <FormField label="금액" error={amountError}>
              <Input type="number" inputMode="numeric" name="amount" value={form.amount} onChange={handleChange} required />
            </FormField>
          </div>

          <div className="form-row">
            <FormField label={isTransfer ? '출금 자산' : '자산'}>
              <Select
                name="assetId"
                options={isTransfer ? fromAssetOptions : assetOptions}
                value={form.assetId ?? ''}
                onChange={handleChange}
                placeholder={isTransfer ? '선택하세요' : '선택 안 함'}
              />
            </FormField>
            <FormField label="거래일">
              <Input type="date" name="transactionDate" value={form.transactionDate} onChange={handleChange} required />
            </FormField>
          </div>

          {isTransfer && (
            <FormField label="입금 자산" error={assetError}>
              <Select
                name="toAssetId"
                options={toAssetOptions}
                value={form.toAssetId ?? ''}
                onChange={handleChange}
                placeholder="선택하세요"
              />
            </FormField>
          )}

          <FormField label="내용">
            <Input name="memo" value={form.memo} onChange={handleChange} maxLength={MEMO_MAX_LENGTH} />
          </FormField>

          {!isTransfer && (
          <div className="form-row">
            <FormField label="카테고리" error={categoryError}>
              <Select
                  name="categoryId"
                  options={categoryOptions}
                  value={form.categoryId}
                  onChange={handleChange}
                  placeholder="선택하세요"
              />
            </FormField>
            <FormField label="태그">
              <Select
                  name="tagId"
                  options={tagOptions}
                  value={form.tagId}
                  onChange={handleChange}
                  placeholder="선택 안 함"
                  disabled={!form.categoryId}
              />
            </FormField>
          </div>
          )}
        </div>
      )}

      <div className="form-actions">
        {onDelete && <Button type="button" variant="danger" size="sm" className="form-actions-delete" onClick={onDelete}>삭제</Button>}
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>취소</Button>}
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? '저장 중...' : '저장'}
        </Button>
      </div>
    </form>
  );
}

export default TransactionForm;

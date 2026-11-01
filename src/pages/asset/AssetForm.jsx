import {useState} from "react";
import Button from "../../components/common/Button.jsx";
import Input from "../../components/common/Input.jsx";
import Select from "../../components/common/Select.jsx";
import FormField from "../../components/common/FormField.jsx";
import {digitLengthError} from "../../utils/validation.js";
import {TYPE_OPTIONS, isCardType} from "./assetLabels.js";

const EMPTY = {name: '', type: 'BANK', balance: '', linkedAssetId: ''};

const NAME_MAX_LENGTH = 30; // DB name 컬럼 varchar(30)
const BALANCE_MAX_DIGITS = 15; // DB balance는 BIGINT지만 JS Number 정밀도 한계에 맞춰 제한


// props
//   initialValue       : 수정 시 기존 asset 객체, 생성 시 undefined
//   onSubmit            : (payload) => void   ← 부모가 mutation 실행
//   onCancel            : () => void
//   submitting          : boolean             ← mutation.isPending
//   bankOptions         : 체크카드 연결 계좌 후보 [{value, label}] (자기 자신 제외 입출금 계좌)
function AssetForm({initialValue, onSubmit, onCancel, submitting, bankOptions = []}) {
  const [form, setForm] = useState({...EMPTY, ...initialValue, linkedAssetId : initialValue?.linkedAssetId ?? ''});
  const [linkError, setLinkError] = useState('');
  const [nameError, setNameError] = useState('');
  const [balanceError, setBalanceError] = useState('');

  // 필드 하나 바뀔 때 객체 일부만 갱신하는 패턴
  const handleChange = (e) => {
    const {name, value} = e.target;
    setForm((prev) => ({...prev, [name]: value}));
    if (name === 'name') setNameError('');
    if (name === 'balance') setBalanceError('');
    if (name === 'linkedAssetId' || name === 'type') setLinkError('');
  }

  const isCard = isCardType(form.type);
  const isCheckCard = form.type === 'CHECK_CARD';

  const handleSubmit = (e) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) {
      setNameError('자산명을 입력해주세요.');
      return;
    }

    if (isCheckCard && !form.linkedAssetId) {
      setLinkError('연결할 입출금 계좌를 선택해주세요.');
      return;
    }

    if (!isCard) {
      const balanceDigitError = digitLengthError(form.balance, BALANCE_MAX_DIGITS, '잔액');
      if (balanceDigitError) {
        setBalanceError(balanceDigitError);
        return;
      }
    }

    const payload = {
      name,
      type: form.type,
      balance: isCard ? null : Number(form.balance || 0),
      linkedAssetId: isCheckCard ? Number(form.linkedAssetId) : null,
    };
    onSubmit(payload);
  };

  return (
      <form onSubmit={handleSubmit} className="form-card">
        <FormField label="자산명" error={nameError}>
          <Input name="name" value={form.name} onChange={handleChange} maxLength={NAME_MAX_LENGTH} required/>
        </FormField>

        <FormField label="종류">
          <Select name="type" options={TYPE_OPTIONS} value={form.type} onChange={handleChange} required />
        </FormField>

        {isCheckCard && (
            <FormField label="출금 계좌" error={linkError}>
              <Select name="linkedAssetId" options={bankOptions} value={form.linkedAssetId}
                      onChange={handleChange} placeholder="체크카드가 연결된 계좌" />
              <p className="form-hint">
                {bankOptions.length === 0
                  ? '먼저 입출금 계좌를 등록해주세요.'
                  : '체크카드로 쓴 금액은 이 계좌 잔액에서 바로 빠집니다.'}
              </p>
            </FormField>
        )}

        {!isCard && (
            <FormField label="잔액" error={balanceError}>
              <Input type="number" inputMode="numeric" name="balance" value={form.balance} onChange={handleChange} />
            </FormField>
        )}

        <div className="form-actions">
          {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>취소</Button>}
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
  );
}

export default AssetForm;
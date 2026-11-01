import {useState} from "react";
import Button from "../../components/common/Button.jsx";
import Input from "../../components/common/Input.jsx";
import FormField from "../../components/common/FormField.jsx";

const EMPTY = {name : '', icon : '', color : ''};

const NAME_MAX_LENGTH = 30; // DB name 컬럼 varchar(30)
const ICON_MAX_LENGTH = 30; // DB icon 컬럼 varchar(30)
const COLOR_MAX_LENGTH = 20; // DB color 컬럼 varchar(20)

// props
//   initialValue        : 수정 시 기존 category 객체, 생성 시 undefined
//   onSubmit            : (payload) => void
//   onCancel            : () => void
//   onDelete            : () => void  (수정 시 삭제 가능한 경우에만 전달)
//   submitting          : boolean
function CategoryForm({initialValue, onSubmit, onCancel, onDelete, submitting}) {
  const [form, setForm] = useState({...EMPTY, ...initialValue});
  const [nameError, setNameError] = useState('');

  const handleChange = (e) => {
    const {name, value} = e.target;
    setForm((prev) => ({...prev, [name]: value}));
    if (name === 'name') setNameError('');
  };

  const handelSubmit = (e) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) {
      setNameError('카테고리 이름을 입력해주세요.');
      return;
    }

    const payload = {
      name,
      icon : form.icon,
      color : form.color
    };
    onSubmit(payload);
  };

  return (
      <form onSubmit={handelSubmit} className="form-card">
        <div className="form-row">
          <FormField label="이름" error={nameError}>
            <Input name="name" value={form.name} onChange={handleChange} maxLength={NAME_MAX_LENGTH} required />
          </FormField>
          <FormField label="아이콘">
            <Input name="icon" value={form.icon} onChange={handleChange} maxLength={ICON_MAX_LENGTH} />
          </FormField>
        </div>
        <FormField label="색상">
          <Input name="color" value={form.color} onChange={handleChange} maxLength={COLOR_MAX_LENGTH}/>
        </FormField>

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

export default CategoryForm;
import {useEffect, useState} from "react";
import Button from "../../components/common/Button.jsx";
import Input from "../../components/common/Input.jsx";
import Select from "../../components/common/Select.jsx";
import FormField from "../../components/common/FormField.jsx";

const EMPTY = {categoryId : null, name : '', color : ''};

const NAME_MAX_LENGTH = 30; // DB name 컬럼 varchar(30)
const COLOR_MAX_LENGTH = 20; // DB color 컬럼 varchar(20)

// props
//   initialValue : 수정 시 기존 tag 객체, 생성 시 { categoryId }만 채운 객체
//   categories   : 전체 카테고리 목록 [{ id, name }, ...]  ← 부모(TagListPage)가 내려줌
//   onSubmit     : (payload) => void
//   onCancel     : () => void
//   onDelete     : () => void  (수정 시에만 전달, 생성 폼에서는 없음)
//   submitting   : boolean
function TagForm({initialValue, categories, onSubmit, onCancel, onDelete, submitting}) {
  const [form, setForm] = useState({...EMPTY, ...initialValue});
  const [nameError, setNameError] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // 신규 생성 시 : 처음 렌더링될 때 categoryId는 있지만 color이 비어있으면 해당 카테고리 색상으로 한번 채워줌
  useEffect(() => {
    if (!initialValue?.color && form.categoryId && !form.color) {
      const matched = categories.find((c) => c.id === Number(form.categoryId));
      if (matched) {
        setForm((prev) => ({...prev, color: matched.color}));
      }
    }
  }, [categories]);

  const handleChange = (e) => {
    const {name, value} = e.target;
    setForm((prev) => {
      const next = {...prev, [name]: value};

      // 카테고리를 바꾸면 그 카테고리의 색상으로 자동 갱신 (사용자가 직접 바꾼 색은 유지하지 않고 새 카테고리 기준으로 리셋)
      if (name === 'categoryId') {
        const matched = categories.find((c) => c.id === Number(value));
        next.color = matched ? matched.color : '';
      }
      return next;
    });
    if (name === 'name') setNameError('');
    if (name === 'categoryId') setCategoryError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) {
      setNameError('태그명을 입력해주세요.');
      return;
    }
    if (!form.categoryId) {
      setCategoryError('카테고리를 선택해주세요.');
      return;
    }

    const payload = {
      categoryId: Number(form.categoryId),
      name,
      color : form.color
    };
    onSubmit(payload);
  };

  const categoryOptions = categories.map((c) => ({value: c.id, label : c.name}));

  return(
      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-row">
          <FormField label="카테고리" error={categoryError}>
            <Select
              name="categoryId"
              options={categoryOptions}
              value={form.categoryId ?? ''}
              onChange={handleChange}
            />
          </FormField>
          <FormField label="태그명" error={nameError}>
            <Input name="name" value={form.name} onChange={handleChange} maxLength={NAME_MAX_LENGTH} required />
          </FormField>
        </div>
        <FormField label="색상">
          <Input name="color" value={form.color} onChange={handleChange} maxLength={COLOR_MAX_LENGTH} />
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

export default TagForm;
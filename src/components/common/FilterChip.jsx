import Icon from "./Icon.jsx";

// 투명 select를 칩 위에 겹쳐 네이티브 선택창을 사용 (month-switcher와 같은 기법)
// props : label, value, options [{value, label}], onChange (value) => void ('' = 해제)
function FilterChip({label, value, options, onChange}) {
  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <span className={`filter-chip${value ? ' is-active' : ''}`}>
      <label className="filter-chip-label">
        {selected?.label ?? label}
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{label} 전체</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {value && (
        <button type="button" className="filter-chip-clear" aria-label={`${label} 필터 해제`}
                onClick={() => onChange('')}><Icon name="close" size={13}/></button>
      )}
    </span>
  );
}

export default FilterChip;

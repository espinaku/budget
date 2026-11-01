import Icon from "./Icon.jsx";
import {ALL_MONTHS, getCurrentMonth, formatMonthLabel, shiftMonth} from "../../utils/month.js";

// props
//   value    : 'YYYY-MM' 또는 ALL_MONTHS
//   onChange : (value) => void
//   allowAll : true면 "전체" 버튼 표시
function MonthSwitcher({value, onChange, allowAll = false}) {
  const isAll = value === ALL_MONTHS;
  const month = isAll ? getCurrentMonth() : value;

  return (
    <div className="month-switcher">
      <button type="button" className="month-switcher-arrow" aria-label="이전 달"
              onClick={() => onChange(shiftMonth(month, -1))}><Icon name="back" size={16}/></button>
      <label className="month-switcher-label">
        {isAll ? '전체 기간' : formatMonthLabel(month)}
        <input type="month" value={month} onChange={(e) => e.target.value && onChange(e.target.value)}/>
      </label>
      <button type="button" className="month-switcher-arrow" aria-label="다음 달"
              onClick={() => onChange(shiftMonth(month, 1))}><Icon name="forward" size={16}/></button>
      {allowAll && (
        <button type="button" className={`month-switcher-all${isAll ? ' is-active' : ''}`}
                aria-pressed={isAll}
                onClick={() => onChange(isAll ? getCurrentMonth() : ALL_MONTHS)}>전체</button>
      )}
    </div>
  );
}

export default MonthSwitcher;

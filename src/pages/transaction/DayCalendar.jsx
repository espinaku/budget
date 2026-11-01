import {useMemo, useState} from "react";
import Icon from "../../components/common/Icon.jsx";
import {WEEKDAYS, buildWeeks} from "../../utils/month.js";
import {todayLocal} from "../../utils/parseTransactionText.js";

// 칸이 좁아 100만 이상은 만 단위로 줄여 표시
const compact = (value) => (value >= 1_000_000
  ? `${Math.round(value / 10_000).toLocaleString()}만`
  : value.toLocaleString());

// 일별 수입/지출 달력 (토스형). 기본은 한 주만, ⌄로 한 달 전체 펼침
// props
//   month    : 'YYYY-MM'
//   sums     : [{date, income, expense}] (GET /api/transactions/daily)
//   selected : 'YYYY-MM-DD' | ''  선택한 날 (목록이 그날로 좁혀짐)
//   onSelect : (date | '') => void  같은 날을 다시 누르면 '' (해제)
function DayCalendar({month, sums, selected, onSelect}) {
  const [expanded, setExpanded] = useState(false);
  const byDate = useMemo(() => new Map((sums ?? []).map((s) => [s.date, s])), [sums]);
  const weeks = useMemo(() => buildWeeks(month), [month]);
  const today = todayLocal();

  // 접힌 상태에서 보여줄 주: 선택한 날 > 오늘(이번 달일 때) > 1일
  const anchor = selected || (today.startsWith(month) ? today : `${month}-01`);
  const visibleWeeks = expanded ? weeks : weeks.filter((w) => w.includes(anchor));

  return (
    <div className="day-cal">
      <div className="day-cal-row">
        {WEEKDAYS.map((w) => <span key={w} className="day-cal-weekday">{w}</span>)}
      </div>
      {visibleWeeks.map((week) => (
        <div key={week.find(Boolean)} className="day-cal-row">
          {week.map((date, i) => {
            if (!date) return <span key={`empty-${i}`}/>;
            const sum = byDate.get(date);
            const classes = ['day-cal-cell'];
            if (date === selected) classes.push('is-selected');
            if (date === today) classes.push('is-today');
            if (date > today) classes.push('is-future');
            return (
              <button key={date} type="button" className={classes.join(' ')}
                      aria-pressed={date === selected}
                      onClick={() => onSelect(date === selected ? '' : date)}>
                <span className="day-cal-num">{Number(date.slice(8))}</span>
                {sum?.income > 0 && <span className="day-cal-in">+{compact(sum.income)}</span>}
                {sum?.expense > 0 && <span className="day-cal-out">-{compact(sum.expense)}</span>}
              </button>
            );
          })}
        </div>
      ))}
      <button type="button" className={`day-cal-toggle${expanded ? ' is-open' : ''}`}
              aria-label={expanded ? '한 주만 보기' : '한 달 보기'}
              onClick={() => setExpanded((v) => !v)}>
        <Icon name="chevronDown" size={20}/>
      </button>
    </div>
  );
}

export default DayCalendar;

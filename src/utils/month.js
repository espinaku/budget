export const ALL_MONTHS = 'all'; // 월 스위처의 "전체" 값

const pad = (n) => String(n).padStart(2, '0');

// UTC가 아닌 로컬 기준 (한국시간 매월 1일 0~9시에 전달로 잡히지 않도록)
export const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

// month(yyyy-mm)의 첫날·말일
export const monthRange = (month) => {
  const [y, m] = month.split('-').map(Number);
  return {from : `${month}-01`, to : `${month}-${pad(new Date(y, m, 0).getDate())}`};
};

export const formatMonthLabel = (month) => {
  const [y, m] = month.split('-');
  return `${Number(y)}년 ${Number(m)}월`;
}

// month(yyyy-mm)에서 delta개월 이동한 월을 같은 형식으로 반환
export const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};


export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 'YYYY-MM-DD' → 로컬 Date (new Date('YYYY-MM-DD')는 UTC로 해석되므로 사용하지 않음)
export const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// 'YYYY-MM-DD' 형식이면서 달력에 실제로 있는 날짜인지 (2026-02-31 같은 값 거부)
export const isRealDate = (dateStr) => {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = parseLocalDate(dateStr);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

// 날짜 그룹 제목. withMonth=false면 "30일 금요일", true면 "10월 30일 금요일" (올해가 아니면 연도 포함)
export const formatDayHeader = (dateStr, withMonth) => {
  const d = parseLocalDate(dateStr);
  const year = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}년 ` : '';
  const month = withMonth ? `${year}${d.getMonth() + 1}월 ` : '';
  return `${month}${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
};

// 원장 날짜 칸 "10.24"
export const formatShortDay = (dateStr) => {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

// month의 달력 주 목록. 각 주는 7칸, 그 달이 아닌 칸은 null
export const buildWeeks = (month) => {
  const [y, m] = month.split('-').map(Number);
  const offset = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells = [...Array(offset).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(`${month}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

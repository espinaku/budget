import {describe, expect, it} from 'vitest';
import {buildWeeks, formatMonthLabel, formatShortDay, isRealDate, monthRange, parseLocalDate, shiftMonth} from './month.js';

describe('month', () => {
  it('실제 달력 날짜 판정', () => {
    expect(['2026-02-28', '2028-02-29', '2026-12-31'].every(isRealDate)).toBe(true);
    expect(['2026-02-29', '2026-02-31', '2026-13-01', '2026-00-10', '2026-1-1', '', null, undefined].some(isRealDate))
      .toBe(false);
  });

  it('월의 첫날과 말일 (윤년 포함)', () => {
    expect(monthRange('2026-02')).toEqual({from : '2026-02-01', to : '2026-02-28'});
    expect(monthRange('2028-02').to).toBe('2028-02-29');
  });
  it('연도를 넘겨 이동한다', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('표시 형식', () => {
    expect(formatMonthLabel('2026-03')).toBe('2026년 3월');
    expect(formatShortDay('2026-10-04')).toBe('10.4');
  });
  it('날짜 문자열을 로컬 기준으로 해석한다', () => expect(parseLocalDate('2026-10-01').getDate()).toBe(1));
  it('달력은 7칸 단위로 그 달의 모든 날을 포함한다', () => {
    const weeks = buildWeeks('2026-10');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks[0][4]).toBe('2026-10-01'); // 2026-10-01은 목요일
  });
});

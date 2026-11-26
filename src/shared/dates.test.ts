import { addDays, addMonths, friendlyTime, monthGrid, monthLabel, shortDateLabel, weekdayMon0 } from './dates';

describe('dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('adds months', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
  });

  it('builds a Monday-first month grid', () => {
    // 1 Dec 2026 is a Tuesday → one leading blank.
    expect(weekdayMon0('2026-12-01')).toBe(1);
    const grid = monthGrid('2026-12');
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBe('2026-12-01');
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  it('formats labels', () => {
    expect(monthLabel('2026-12')).toBe('December 2026');
    expect(shortDateLabel('2026-12-10')).toBe('Thu 10 Dec');
    expect(friendlyTime('17:00')).toBe('5pm');
    expect(friendlyTime('09:30')).toBe('9:30am');
    expect(friendlyTime('00:00')).toBe('12am');
  });
});

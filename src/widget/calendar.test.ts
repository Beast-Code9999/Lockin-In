import { addDaysIso, calendarGrid, calendarLayout, calendarSvg, monthStats, statusOn, type History } from './calendar';

// Today: Wed 2026-12-09. Pact signed 2026-12-01 (a Tuesday).
const TODAY = '2026-12-09';
const history: History = {
  from: '2026-12-01',
  firstEligible: '2026-12-01',
  //     1   2   3   4   5   6   7   8   9
  days: 'c' + 'c' + 's' + 'm' + 'f' + 'v' + 'c' + '-' + '-',
};

describe('statusOn', () => {
  it.each([
    ['2026-12-01', 'clean'],
    ['2026-12-03', 'slipped'],
    ['2026-12-04', 'missed'],
    ['2026-12-05', 'frozen'],
    ['2026-12-06', 'vacation'],
    ['2026-12-08', 'open'], // yesterday, still in the backfill window
    ['2026-12-09', 'open'], // today
    ['2026-11-30', 'beforePact'],
    ['2026-12-10', 'future'],
  ])('%s → %s', (date, status) => {
    expect(statusOn(history, date, TODAY)).toBe(status);
  });

  it('a past day with no record (finaliser not run yet) is empty, not open', () => {
    expect(statusOn({ ...history, days: 'c------' }, '2026-12-03', TODAY)).toBe('empty');
  });

  it('no crew yet: nothing counts', () => {
    expect(statusOn({ ...history, firstEligible: null }, '2026-12-05', TODAY)).toBe('beforePact');
  });
});

describe('calendarLayout', () => {
  it.each([
    [320, 60],
    [320, 110],
    [320, 200],
    [400, 300],
    [600, 420],
  ])('the grid fits inside a %ix%i widget', (w, h) => {
    const l = calendarLayout(w, h);
    expect(l.svgWidth).toBeLessThanOrEqual(w - l.padding * 2);
    expect(l.svgHeight + l.headerHeight).toBeLessThanOrEqual(h - l.padding * 2);
    expect(l.cols).toBeGreaterThan(0);
  });

  it('a 4×1 strip is a compact heatmap: no numbers, no header', () => {
    const l = calendarLayout(320, 60);
    expect(l.showNumbers).toBe(false);
    expect(l.headerHeight).toBe(0);
    expect(l.cols).toBeGreaterThan(20);
  });

  it('a 4×3+ shows dates, months and weekday labels', () => {
    const l = calendarLayout(400, 300);
    expect(l.showNumbers).toBe(true);
    expect(l.monthRowHeight).toBeGreaterThan(0);
    expect(l.dayLabelWidth).toBeGreaterThan(0);
  });
});

describe('calendarGrid', () => {
  it('ends with the current week, Monday first', () => {
    const { weeks } = calendarGrid(history, TODAY, 4);
    const last = weeks[3]!;
    expect(last[0]!.date).toBe('2026-12-07'); // Monday
    expect(last[6]!.date).toBe('2026-12-13'); // Sunday
    expect(last[2]!.isToday).toBe(true);
    expect(weeks[0]![0]!.date).toBe(addDaysIso('2026-12-07', -21));
  });

  it('labels the first column and each new month, with the year when it changes', () => {
    const { months } = calendarGrid(history, '2027-01-20', 10);
    expect(months.map((m) => m.text)).toEqual(['Nov 2026', 'Dec', 'Jan 2027']);
  });
});

describe('calendarSvg', () => {
  it('draws one cell per day and a number when there is room', () => {
    const grid = calendarGrid(history, TODAY, 5);
    const small = calendarSvg(grid, { ...calendarLayout(320, 60), cols: 5 });
    expect(small.match(/<rect /g)).toHaveLength(35);
    expect(small).not.toContain('>9<');
    const big = calendarSvg(grid, { ...calendarLayout(400, 300), cols: 5 });
    expect(big).toContain('>9</text>');
    expect(big).toContain('Mon</text>');
  });
});

describe('monthStats', () => {
  it('counts clean days and played days this month', () => {
    expect(monthStats(history, TODAY)).toEqual({ clean: 3, played: 5 });
  });
});

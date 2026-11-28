/**
 * Calendar widget (history heatmap). Pure: layout from the widget's real size, the
 * week grid from the snapshot's history strip, and the SVG that draws it.
 * One SvgWidget instead of hundreds of RemoteViews keeps the widget light.
 *
 * Grid: one column per week (oldest left, this week right), rows Mon → Sun.
 */
import type { WidgetSnapshot } from './snapshot';

export type CellStatus = 'clean' | 'slipped' | 'missed' | 'frozen' | 'vacation' | 'open' | 'empty' | 'beforePact' | 'future';

export type History = NonNullable<WidgetSnapshot['history']>;

const CODE: Record<string, CellStatus> = { c: 'clean', s: 'slipped', m: 'missed', f: 'frozen', v: 'vacation' };

// ---------------------------------------------------------------- dates (UTC-safe, 'YYYY-MM-DD')
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysIso = (iso: string, n: number) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
/** 0 = Monday … 6 = Sunday */
const weekday = (iso: string) => (toDate(iso).getUTCDay() + 6) % 7;

export function statusOn(history: History | null | undefined, date: string, today: string): CellStatus {
  if (date > today) return 'future';
  if (!history) return 'empty';
  if (history.firstEligible && date < history.firstEligible) return 'beforePact';
  if (!history.firstEligible) return 'beforePact';
  const i = daysBetween(history.from, date);
  const code = i >= 0 && i < history.days.length ? history.days[i] : undefined;
  const known = code ? CODE[code] : undefined;
  if (known) return known;
  // No record: today and yesterday are still open (SPEC §4 backfill window).
  return daysBetween(date, today) <= 1 ? 'open' : 'empty';
}

// ---------------------------------------------------------------- layout
export type CalendarLayout = {
  padding: number;
  headerHeight: number;
  monthRowHeight: number;
  dayLabelWidth: number;
  cell: number;
  gap: number;
  cols: number;
  showNumbers: boolean;
  /** SVG size in dp. */
  svgWidth: number;
  svgHeight: number;
};

export const MAX_WEEKS = 53;

export function calendarLayout(width: number, height: number): CalendarLayout {
  const padding = height < 70 ? 6 : height < 90 ? 8 : 12;
  const headerHeight = height >= 110 ? 24 : 0;
  const inner = height - padding * 2 - (headerHeight ? headerHeight + 6 : 0);
  const gap = inner >= 180 ? 4 : inner >= 110 ? 3 : 2;
  const monthRowHeight = inner >= 7 * 12 + 6 * gap + 14 ? 14 : 0;
  const cell = Math.max(4, Math.min(34, Math.floor((inner - monthRowHeight - 6 * gap) / 7)));
  const dayLabelWidth = cell >= 16 ? 38 : 0;
  const usableWidth = width - padding * 2 - dayLabelWidth;
  const cols = Math.max(1, Math.min(MAX_WEEKS, Math.floor((usableWidth + gap) / (cell + gap))));
  return {
    padding,
    headerHeight,
    monthRowHeight,
    dayLabelWidth,
    cell,
    gap,
    cols,
    showNumbers: cell >= 16,
    svgWidth: cols * (cell + gap) - gap + dayLabelWidth,
    svgHeight: monthRowHeight + 7 * (cell + gap) - gap,
  };
}

// ---------------------------------------------------------------- grid
export type CalendarCell = { date: string; status: CellStatus; isToday: boolean; day: number };
export type MonthLabel = { col: number; text: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function calendarGrid(history: History | null | undefined, today: string, cols: number): { weeks: CalendarCell[][]; months: MonthLabel[] } {
  const thisMonday = addDaysIso(today, -weekday(today));
  const firstMonday = addDaysIso(thisMonday, -7 * (cols - 1));
  const weeks: CalendarCell[][] = [];
  const months: MonthLabel[] = [];
  let lastMonthKey = '';
  let lastYear = '';
  for (let c = 0; c < cols; c++) {
    const week: CalendarCell[] = [];
    for (let r = 0; r < 7; r++) {
      const date = addDaysIso(firstMonday, c * 7 + r);
      week.push({ date, status: statusOn(history, date, today), isToday: date === today, day: Number(date.slice(8, 10)) });
    }
    // Label a column when a new month starts inside it (or it's the first column).
    const startsMonth = week.find((d) => d.day === 1);
    const anchor = c === 0 ? week[0]! : startsMonth;
    if (anchor && anchor.date.slice(0, 7) !== lastMonthKey) {
      const year = anchor.date.slice(0, 4);
      const month = MONTHS[Number(anchor.date.slice(5, 7)) - 1] ?? '';
      months.push({ col: c, text: year !== lastYear ? `${month} ${year}` : month });
      lastMonthKey = anchor.date.slice(0, 7);
      lastYear = year;
    }
    weeks.push(week);
  }
  return { weeks, months };
}

/** "18 clean in Nov" style numbers for the header. */
export function monthStats(history: History | null | undefined, today: string): { clean: number; played: number } {
  let clean = 0;
  let played = 0;
  for (let d = `${today.slice(0, 7)}-01`; d <= today; d = addDaysIso(d, 1)) {
    const s = statusOn(history, d, today);
    if (s === 'clean') clean++;
    if (s === 'clean' || s === 'slipped' || s === 'missed') played++;
  }
  return { clean, played };
}

// ---------------------------------------------------------------- SVG
const FILL: Record<CellStatus, { bg: string; stroke: string; text: string }> = {
  clean: { bg: '#39FF88', stroke: '#39FF88', text: '#04361C' },
  slipped: { bg: '#FF4D6D', stroke: '#FF4D6D', text: '#FFFFFF' },
  missed: { bg: '#FFB020', stroke: '#FFB020', text: '#3A2500' },
  frozen: { bg: '#7FD8FF', stroke: '#7FD8FF', text: '#081537' },
  vacation: { bg: '#3DD9C1', stroke: '#3DD9C1', text: '#081537' },
  open: { bg: '#0E2052', stroke: '#7FE7FF', text: '#7FE7FF' },
  empty: { bg: '#16306F', stroke: '#16306F', text: '#93AEDF' },
  beforePact: { bg: '#0E2052', stroke: '#0E2052', text: '#3B5590' },
  future: { bg: '#0B1A45', stroke: '#0B1A45', text: '#2A4580' },
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function calendarSvg(grid: { weeks: CalendarCell[][]; months: MonthLabel[] }, l: CalendarLayout): string {
  const parts: string[] = [];
  const radius = Math.max(1.5, Math.round(l.cell * 0.22));
  const font = 'font-family="sans-serif" font-weight="bold"';
  const top = l.monthRowHeight;

  if (l.monthRowHeight) {
    for (const m of grid.months) {
      parts.push(`<text x="${m.col * (l.cell + l.gap)}" y="${l.monthRowHeight - 4}" font-size="11" fill="#93AEDF" ${font}>${m.text}</text>`);
    }
  }
  grid.weeks.forEach((week, c) => {
    week.forEach((d, r) => {
      const x = c * (l.cell + l.gap);
      const y = top + r * (l.cell + l.gap);
      const f = FILL[d.status];
      const stroke = d.isToday ? '#FFFFFF' : f.stroke;
      const sw = d.isToday || d.status === 'open' ? 1.5 : 0;
      const inset = sw / 2;
      parts.push(
        `<rect x="${x + inset}" y="${y + inset}" width="${l.cell - sw}" height="${l.cell - sw}" rx="${radius}" fill="${f.bg}"${sw ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`,
      );
      if (l.showNumbers) {
        parts.push(
          `<text x="${x + l.cell / 2}" y="${y + l.cell / 2}" dy="0.35em" text-anchor="middle" font-size="${Math.round(l.cell * 0.48)}" fill="${f.text}" ${font}>${d.day}</text>`,
        );
      }
    });
  });
  if (l.dayLabelWidth) {
    const x = l.cols * (l.cell + l.gap) + 6;
    DAY_LABELS.forEach((label, r) => {
      parts.push(`<text x="${x}" y="${top + r * (l.cell + l.gap) + l.cell / 2}" dy="0.35em" font-size="${Math.min(12, Math.round(l.cell * 0.45))}" fill="#93AEDF" ${font}>${label}</text>`);
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${l.svgWidth}" height="${l.svgHeight}" viewBox="0 0 ${l.svgWidth} ${l.svgHeight}">${parts.join('')}</svg>`;
}

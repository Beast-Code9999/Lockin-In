/**
 * Local-date helpers on plain 'YYYY-MM-DD' strings. The server decides what
 * "today" is in the player's timezone (CLAUDE.md rule 7); the client only does
 * calendar arithmetic, done in UTC so the device timezone can never leak in.
 */
export type LocalDate = string; // 'YYYY-MM-DD'

const toUtc = (d: LocalDate) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1));
};
const fromUtc = (d: Date): LocalDate => d.toISOString().slice(0, 10);

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const d = toUtc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return fromUtc(d).slice(0, 7);
}

/** 0 = Monday … 6 = Sunday (Australian weeks start on Monday). */
export function weekdayMon0(date: LocalDate): number {
  return (toUtc(date).getUTCDay() + 6) % 7;
}

/** Calendar cells for a month: leading nulls to align Monday, then each date. */
export function monthGrid(month: string): (LocalDate | null)[] {
  const first = `${month}-01`;
  const cells: (LocalDate | null)[] = Array.from({ length: weekdayMon0(first) }, () => null);
  for (let d = first; monthKey(d) === month; d = addDays(d, 1)) cells.push(d);
  return cells;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** e.g. "Thu 10 Dec" */
export function shortDateLabel(date: LocalDate): string {
  const d = toUtc(date);
  return `${DAYS[weekdayMon0(date)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]?.slice(0, 3)}`;
}

/** '17:00' → '5pm', '09:30' → '9:30am' */
export function friendlyTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

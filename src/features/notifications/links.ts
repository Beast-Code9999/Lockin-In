/**
 * Notification deep links (SPEC §13). The server puts an in-app route in `data.link`;
 * only routes on this allow-list are opened, anything else falls back to Home.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ALLOWED: RegExp[] = [
  /^\/$/,
  /^\/leaderboard$/,
  /^\/history$/,
  /^\/votes$/,
  /^\/settings$/,
  new RegExp(`^/profile/${UUID}$`, 'i'),
];

export type AppLink = '/' | `/${string}`;

export function routeForLink(link: unknown): AppLink {
  if (typeof link !== 'string') return '/';
  return ALLOWED.some((re) => re.test(link)) ? (link as AppLink) : '/';
}

/** 'HH:MM' shifted by `minutes`, wrapping around midnight. */
export function shiftTime(hhmm: string, minutes: number): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** 'HH:MM' → '9:00pm' */
export function timeLabel(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

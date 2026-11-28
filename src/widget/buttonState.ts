/**
 * Widget button state (SPEC §12.3). Pure — derived from the cached snapshot, the
 * current local clock and the widget's own transient state. Slips are never offered.
 */
import type { WidgetSnapshot } from './snapshot';

export type WidgetLocalState = {
  /** ISO time until which the "tap again to confirm" step is armed. */
  pendingConfirmUntil: string | null;
  /** A check-in request is running. */
  inFlight: boolean;
  /** A check-in is queued offline (by local date). */
  queuedDate: string | null;
  /** Points to flash after a successful check-in, for one render. */
  justGained: number | null;
};

export const EMPTY_LOCAL_STATE: WidgetLocalState = { pendingConfirmUntil: null, inFlight: false, queuedDate: null, justGained: null };

export type WidgetButton =
  | { kind: 'signedOut' }
  | { kind: 'joinCrew' }
  | { kind: 'openBox'; boxId: string }
  | { kind: 'opensLater'; opensAt: string }
  | { kind: 'backfill'; date: string }
  | { kind: 'ready'; date: string }
  | { kind: 'confirm'; date: string }
  | { kind: 'inFlight' }
  | { kind: 'queued' }
  | { kind: 'done'; gained: number | null };

export type LocalClock = { today: string; time: string };

/** "Now" in the player's timezone; falls back to the device clock if Intl can't do timezones. */
export function localClock(timezone: string, now: Date = new Date()): LocalClock {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
    return { today: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
  } catch {
    const p = (n: number) => String(n).padStart(2, '0');
    return { today: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`, time: `${p(now.getHours())}:${p(now.getMinutes())}` };
  }
}

const previousDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Self-correcting (SPEC §12.5): if the snapshot is from an earlier local day,
 * today isn't checked in yet and yesterday is pending unless the snapshot's day was checked.
 */
export function freshDayFlags(snapshot: WidgetSnapshot, clock: LocalClock): { checkedInToday: boolean; yesterdayPending: boolean; stale: boolean } {
  const { me } = snapshot;
  if (me.todayLocal === clock.today) return { checkedInToday: me.checkedInToday, yesterdayPending: me.yesterdayPending, stale: false };
  const snapshotWasYesterday = previousDay(clock.today) === me.todayLocal;
  return { checkedInToday: false, yesterdayPending: snapshotWasYesterday ? !me.checkedInToday : false, stale: true };
}

export function widgetButton(
  snapshot: WidgetSnapshot | null,
  local: WidgetLocalState,
  clock: LocalClock | null,
  nowMs: number = Date.now(),
): WidgetButton {
  if (!snapshot || !clock) return { kind: 'signedOut' };
  if (!snapshot.me.inGame) return { kind: 'joinCrew' };
  if (snapshot.me.owedBoxId) return { kind: 'openBox', boxId: snapshot.me.owedBoxId };
  if (local.inFlight) return { kind: 'inFlight' };

  const flags = freshDayFlags(snapshot, clock);
  if (local.queuedDate && (local.queuedDate === clock.today || local.queuedDate === previousDay(clock.today))) return { kind: 'queued' };

  const target = flags.yesterdayPending ? previousDay(clock.today) : flags.checkedInToday ? null : clock.today;
  if (!target) return { kind: 'done', gained: local.justGained };

  const armed = local.pendingConfirmUntil !== null && Date.parse(local.pendingConfirmUntil) > nowMs;
  if (target !== clock.today) return armed ? { kind: 'confirm', date: target } : { kind: 'backfill', date: target };
  if (clock.time < snapshot.me.checkinOpensAt) return { kind: 'opensLater', opensAt: snapshot.me.checkinOpensAt };
  return armed ? { kind: 'confirm', date: target } : { kind: 'ready', date: target };
}

/** Header note when the snapshot is old (SPEC §12.5: older than WIDGET_STALE_HOURS). */
export function staleLabel(generatedAt: string, staleHours: number, nowMs: number = Date.now()): string | null {
  const hours = Math.floor((nowMs - Date.parse(generatedAt)) / 3_600_000);
  if (Number.isNaN(hours) || hours < staleHours) return null;
  return hours >= 48 ? `updated ${Math.floor(hours / 24)}d ago` : `updated ${hours}h ago`;
}

/**
 * What the check-in card (and, from M3, the widget button) should show.
 * Pure: derived from `get_home` + the current time. The server still enforces
 * every rule; this only decides the UI.
 */
import type { LocalDate } from '@/shared/dates';

import type { HomeData } from '../home/types';

export type CheckinCardState =
  /** Yesterday is still open and unrecorded — always offered first (SPEC §14.2). */
  | { kind: 'backfill'; date: LocalDate }
  /** Today, after opens-at, nothing recorded. */
  | { kind: 'ready'; date: LocalDate }
  /** Today, before opens-at. */
  | { kind: 'opensLater'; date: LocalDate; opensAt: string }
  | { kind: 'doneClean'; date: LocalDate }
  /** `undoUntil` is set while the 5-minute misclick undo is still available. */
  | { kind: 'doneSlipped'; date: LocalDate; undoUntil: string | null }
  /** Not in a crew / Pact not accepted yet. */
  | { kind: 'notEligible' };

export function checkinCardState(home: HomeData, nowMs: number = Date.now()): CheckinCardState {
  const first = home.group?.first_eligible_date;
  if (!home.group?.pact_accepted_at || !first) return { kind: 'notEligible' };

  if (home.yesterday_local >= first && !home.yesterday) return { kind: 'backfill', date: home.yesterday_local };

  const date = home.today_local;
  if (home.today?.status === 'clean') return { kind: 'doneClean', date };
  if (home.today?.status === 'relapse') {
    const until = new Date(home.today.updated_at).getTime() + home.undo_minutes * 60_000;
    return { kind: 'doneSlipped', date, undoUntil: until > nowMs ? new Date(until).toISOString() : null };
  }
  if (home.today) return { kind: 'doneClean', date }; // system statuses can't occur for today
  return home.local_time >= home.opens_at ? { kind: 'ready', date } : { kind: 'opensLater', date, opensAt: home.opens_at };
}

/** Which date "I slipped" applies to for a given card, or null when slipping isn't offered. */
export function slipTarget(state: CheckinCardState): LocalDate | null {
  switch (state.kind) {
    case 'backfill':
    case 'ready':
    case 'opensLater':
    case 'doneClean':
      return state.date;
    default:
      return null;
  }
}

/**
 * Scoring mirror (SPEC §7) — for UI previews only ("check in now → +12 pts").
 * SQL (`app.score_sequence`, `app.recompute_user_stats`) is the source of truth;
 * both are tested against fixtures/scoring/*.json (tests/scoring.test.ts).
 */
import { CONFIG } from './constants';

export type ScoringStatus = 'clean' | 'relapse' | 'missed' | 'frozen' | 'vacation';
export type ScoredDay = { points: number; streakAfter: number };

/** Points for a clean day that brings the streak to `streakAfter`. */
export function cleanPoints(streakAfter: number): number {
  return CONFIG.BASE_POINTS + Math.ceil(Math.min(streakAfter, CONFIG.STREAK_BONUS_CAP_DAYS) / CONFIG.STREAK_BONUS_DIVISOR);
}

/** Statuses in date order → points and streak after each day. */
export function scoreSequence(statuses: readonly ScoringStatus[]): ScoredDay[] {
  let streak = 0;
  return statuses.map((status) => {
    switch (status) {
      case 'clean':
        streak += 1;
        return { points: cleanPoints(streak), streakAfter: streak };
      case 'relapse':
        streak = 0;
        return { points: 0, streakAfter: 0 };
      case 'missed':
        streak = 0;
        return { points: CONFIG.MISSED_POINTS, streakAfter: 0 };
      default:
        return { points: 0, streakAfter: streak }; // frozen / vacation pause the streak
    }
  });
}

export function summarise(days: readonly ScoredDay[]) {
  return {
    total: days.reduce((sum, d) => sum + d.points, 0),
    currentStreak: days.at(-1)?.streakAfter ?? 0,
    longestStreak: days.reduce((max, d) => Math.max(max, d.streakAfter), 0),
  };
}

/** Preview for the check-in button: what a clean check-in right now is worth. */
export function previewCleanPoints(currentStreak: number): number {
  return cleanPoints(currentStreak + 1);
}

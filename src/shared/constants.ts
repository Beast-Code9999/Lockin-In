/**
 * Tunable constants (SPEC §20) — the single TypeScript source.
 *
 * `CONFIG` mirrors `app.config()` in SQL (supabase/migrations/*_foundations.sql or a later
 * migration that replaces it). tests/constantsParity.test.ts fails if a server value
 * differs from the value here, so change both together.
 */
export const CONFIG = {
  CHECKIN_OPENS_AT: '17:00',
  UNDO_WINDOW_MINUTES: 5,
  BASE_POINTS: 10,
  STREAK_BONUS_CAP_DAYS: 60,
  STREAK_BONUS_DIVISOR: 6,
  MISSED_POINTS: -5,
  SCORE_WINDOW_DAYS: 30,
  FAILED_FORFEIT_SEASON_PENALTY: -50,
  FREEZE_TOKENS_PER_MONTH: 2,
  VACATION_MAX_DAYS_PER_30: 10,
  VACATION_MAX_RANGE_DAYS: 10,
  BOX_OPEN_DEADLINE_HOURS: 24,
  BOX_PROOF_DEADLINE_HOURS: 24,
  BOX_AUTO_CONFIRM_HOURS: 24,
  BOX_RESUBMIT_EXTENSION_HOURS: 12,
  CLOWN_MIN_HOURS: 48,
  WILDCARD_WINDOW_HOURS: 12,
  LEGENDARY_WILDCARD_CHANCE: 0.25,
  REROLLS_PER_SEASON: 1,
  COWARD_AVATAR_DAYS: 7,
  SOS_DURATION_MINUTES: 10,
  SOS_MAX_PER_DAY: 3,
  SOS_WINGMAN_MINUTES: 5,
  SOS_STALE_HOURS: 2,
  TZ_CHANGE_GRACE_HOURS: 24,
  WIDGET_CONFIRM_SECONDS: 5,
  WIDGET_STALE_HOURS: 2,
  FINAL_WARNING_HOURS: 2,
  WIDGET_HISTORY_DAYS: 371,
  DEFAULT_TIMEZONE: 'Australia/Darwin',
  DEFAULT_REMINDER_TIME: '21:00',
  DEFAULT_AVATAR_ID: 'blaze',
  DISPLAY_NAME_MAX_LENGTH: 20,
  GROUP_NAME_MAX_LENGTH: 40,
  CHECKIN_NOTE_MAX_LENGTH: 500,
  LOOT_CAPTION_MAX_LENGTH: 220,
  LOOT_PROMPT_MAX_LENGTH: 140,
  SOS_MESSAGE_MAX_LENGTH: 140,
  INVITE_CODE_LENGTH: 6,
  INVITE_CODE_ALPHABET: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
} as const;

/** Client-only constants (UI feel). Not mirrored in SQL. */
export const UI = {
  /** Hold-to-activate duration for SOS and opening a box (SPEC §9.11, §11.1). */
  HOLD_TO_ACTIVATE_MS: 1500,
  /** Widget rows truncate display names (SPEC §12.2). */
  WIDGET_NAME_MAX: 10,
  /** SOS challenge card rotation (SPEC §11.3). */
  SOS_CHALLENGE_ROTATE_MINUTES: 2,
} as const;

export type ConfigKey = keyof typeof CONFIG;

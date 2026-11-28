import type { Database } from '@/lib/database.types';
import type { LocalDate } from '@/shared/dates';

export type CheckinStatus = Database['public']['Enums']['checkin_status'];
export type CheckinSource = Database['public']['Enums']['checkin_source'];

export type DayRecord = {
  status: CheckinStatus;
  source: CheckinSource;
  created_at: string;
  updated_at: string;
  note: string | null;
};

/** Cached scoring stats (user_stats) — computed on the server (SPEC §7). */
export type PlayerStats = {
  current_streak: number;
  longest_streak: number;
  score_30d: number;
  season_points: number;
  /** Rank *label*, e.g. 'Monk Mode' (see rankKeyFromLabel). */
  rank: string;
  flame_tier: 0 | 1 | 2 | 3 | 4;
  freeze_tokens_left: number;
};

export type CrewMember = {
  id: string;
  display_name: string;
  avatar_id: string;
  is_me: boolean;
  pact_accepted: boolean;
  checked_today: boolean;
  on_vacation_today: boolean;
  stats: PlayerStats;
};

export type Vacation = { id: string; start_date: LocalDate; end_date: LocalDate };

/** Shape returned by the `get_home` RPC (supabase/migrations/*_groups_checkins.sql). */
export type HomeData = {
  now: string;
  me: { id: string; display_name: string; avatar_id: string; timezone: string; reminder_time: string; auto_use_freeze: boolean };
  today_local: LocalDate;
  yesterday_local: LocalDate;
  local_time: string; // 'HH:MM' in the player's timezone
  opens_at: string; // 'HH:MM'
  undo_minutes: number;
  group: null | {
    id: string;
    name: string;
    invite_code: string;
    timezone: string;
    role: 'owner' | 'member';
    pact_accepted_at: string | null;
    first_eligible_date: LocalDate | null;
  };
  season: null | { number: number; starts_on: LocalDate; ends_on: LocalDate; days_left: number };
  stats: PlayerStats;
  /** e.g. "12 pts to catch Miguel 🎯"; null when you're alone. */
  rival: string | null;
  today: DayRecord | null;
  yesterday: DayRecord | null;
  members: CrewMember[];
  /** Your upcoming / ongoing vacations. */
  vacations: Vacation[];
};

export type OnboardingStage = 'crew' | 'pact' | 'done';

export function onboardingStage(home: HomeData): OnboardingStage {
  if (!home.group) return 'crew';
  if (!home.group.pact_accepted_at) return 'pact';
  return 'done';
}

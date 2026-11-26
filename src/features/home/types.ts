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

export type CrewMember = {
  id: string;
  display_name: string;
  avatar_id: string;
  is_me: boolean;
  pact_accepted: boolean;
  checked_today: boolean;
};

/** Shape returned by the `get_home` RPC (supabase/migrations/*_groups_checkins.sql). */
export type HomeData = {
  now: string;
  me: { id: string; display_name: string; avatar_id: string; timezone: string; reminder_time: string };
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
  season: null | { number: number; starts_on: LocalDate; ends_on: LocalDate };
  today: DayRecord | null;
  yesterday: DayRecord | null;
  members: CrewMember[];
};

export type OnboardingStage = 'crew' | 'pact' | 'done';

export function onboardingStage(home: HomeData): OnboardingStage {
  if (!home.group) return 'crew';
  if (!home.group.pact_accepted_at) return 'pact';
  return 'done';
}

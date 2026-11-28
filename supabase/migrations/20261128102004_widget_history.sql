-- =============================================================================
-- Lockin' In — widget pack: your check-in history for the Calendar widget.
-- get_widget_snapshot() gains `history`: one character per local day, oldest first,
-- covering the last WIDGET_HISTORY_DAYS days (53 weeks) up to today:
--   c clean · s slipped · m missed · f frozen · v vacation · - nothing (yet)
-- plus `from` (first day) and `firstEligible` (Pact date; earlier days aren't played).
-- =============================================================================

-- Config: replaces app.config() to add WIDGET_HISTORY_DAYS (parity test reads the latest).
create or replace function app.config()
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select jsonb_build_object(
    -- @config-begin
    'CHECKIN_OPENS_AT', '17:00',
    'UNDO_WINDOW_MINUTES', 5,
    'BASE_POINTS', 10,
    'STREAK_BONUS_CAP_DAYS', 60,
    'STREAK_BONUS_DIVISOR', 6,
    'MISSED_POINTS', -5,
    'SCORE_WINDOW_DAYS', 30,
    'FAILED_FORFEIT_SEASON_PENALTY', -50,
    'FREEZE_TOKENS_PER_MONTH', 2,
    'VACATION_MAX_DAYS_PER_30', 10,
    'VACATION_MAX_RANGE_DAYS', 10,
    'BOX_OPEN_DEADLINE_HOURS', 24,
    'BOX_PROOF_DEADLINE_HOURS', 24,
    'BOX_AUTO_CONFIRM_HOURS', 24,
    'BOX_RESUBMIT_EXTENSION_HOURS', 12,
    'CLOWN_MIN_HOURS', 48,
    'WILDCARD_WINDOW_HOURS', 12,
    'LEGENDARY_WILDCARD_CHANCE', 0.25,
    'REROLLS_PER_SEASON', 1,
    'COWARD_AVATAR_DAYS', 7,
    'SOS_DURATION_MINUTES', 10,
    'SOS_MAX_PER_DAY', 3,
    'SOS_WINGMAN_MINUTES', 5,
    'SOS_STALE_HOURS', 2,
    'TZ_CHANGE_GRACE_HOURS', 24,
    'WIDGET_CONFIRM_SECONDS', 5,
    'WIDGET_STALE_HOURS', 2,
    'FINAL_WARNING_HOURS', 2,
    'WIDGET_HISTORY_DAYS', 371,
    'DEFAULT_TIMEZONE', 'Australia/Darwin',
    'DEFAULT_REMINDER_TIME', '21:00',
    'DEFAULT_AVATAR_ID', 'blaze',
    'DISPLAY_NAME_MAX_LENGTH', 20,
    'GROUP_NAME_MAX_LENGTH', 40,
    'CHECKIN_NOTE_MAX_LENGTH', 500,
    'LOOT_CAPTION_MAX_LENGTH', 220,
    'LOOT_PROMPT_MAX_LENGTH', 140,
    'SOS_MESSAGE_MAX_LENGTH', 140,
    'INVITE_CODE_LENGTH', 6,
    'INVITE_CODE_ALPHABET', 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    -- @config-end
  );
$$;


create or replace function app.history_strip(p_user uuid, p_now timestamptz)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with me as (
    select app.local_today(p.timezone, p_now) as today, gm.first_eligible_date
      from public.profiles p left join public.group_members gm on gm.user_id = p.id
     where p.id = p_user
  ), span as (
    select today, first_eligible_date, today - (app.cfg_int('WIDGET_HISTORY_DAYS') - 1) as from_date from me
  )
  select jsonb_build_object(
    'from', s.from_date,
    'firstEligible', s.first_eligible_date,
    'days', (
      select string_agg(
        case c.status
          when 'clean' then 'c' when 'relapse' then 's' when 'missed' then 'm'
          when 'frozen' then 'f' when 'vacation' then 'v' else '-'
        end, '' order by d)
        from generate_series(s.from_date, s.today, interval '1 day') d
        left join public.checkins c on c.user_id = p_user and c.local_date = d::date
    )
  ) from span s
$$;

create or replace function public.get_widget_snapshot()
returns jsonb language sql security definer set search_path = ''
as $$
  select app.get_widget_snapshot_impl(app.require_uid(), now())
         || jsonb_build_object('history', app.history_strip(app.require_uid(), now()))
$$;

revoke all on function app.history_strip(uuid, timestamptz) from public, anon, authenticated;

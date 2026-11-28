-- =============================================================================
-- Lockin' In — M4: notifications (SPEC §13, §18.2 send_reminders).
--
-- Everything that notifies goes through app.notify(), which:
--   • skips players with no registered phone (nothing to deliver to),
--   • respects notify_prefs (every category except `sos` can be switched off),
--   • de-duplicates with a once-key, so re-runs, undo/redo and overlapping cron
--     runs never send the same notification twice.
-- Rows land in notification_outbox; the M3 trigger kicks `send-push`.
-- Events are raised by triggers on the tables they describe, so every path that
-- changes them (RPCs, finaliser, tests) notifies without extra code.
-- Box / SOS / season / loot notifications arrive with M5–M7 and reuse app.notify().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Config: replaces app.config() to add FINAL_WARNING_HOURS (parity test reads the latest).
-- -----------------------------------------------------------------------------
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

-- Streak milestones that get announced (SPEC §8.4 streak badges).
create or replace function app.streak_milestones()
returns int[] language sql immutable set search_path = ''
as $$ select array[3, 7, 14, 30, 60, 90, 180, 365] $$;

-- -----------------------------------------------------------------------------
-- Preferences. Categories a player can switch off, with their defaults.
-- (`sos` is deliberately absent: it can only be muted in Android settings.)
-- -----------------------------------------------------------------------------
create or replace function app.notify_pref_defaults()
returns jsonb language sql immutable set search_path = ''
as $$ select '{"reminders": true, "group": true, "boxes": true, "friend_checkins": false}'::jsonb $$;

create or replace function app.notify_pref_on(p_prefs jsonb, p_category text)
returns boolean language sql immutable set search_path = ''
as $$
  select case
    when p_category = 'sos' then true
    else coalesce((p_prefs ->> p_category)::boolean, (app.notify_pref_defaults() ->> p_category)::boolean, true)
  end
$$;

-- Sent-once log: (user, key) means "already notified about this".
create table app.notify_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- -----------------------------------------------------------------------------
-- app.notify — queue one visible notification for one player.
--   p_channel  Android channel: reminders | group | boxes | sos
--   p_link     in-app route opened on tap (e.g. '/', '/leaderboard', '/profile/<uid>')
--   p_pref     preference category (defaults to the channel)
--   p_once     once-key; a second call with the same key for the same player is a no-op
-- -----------------------------------------------------------------------------
create or replace function app.notify(
  p_user uuid, p_channel text, p_title text, p_body text, p_link text,
  p_pref text default null, p_once text default null, p_now timestamptz default now()
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_prefs jsonb;
begin
  select notify_prefs into v_prefs from public.profiles where id = p_user;
  if not found then return false; end if;
  if not app.notify_pref_on(v_prefs, coalesce(p_pref, p_channel)) then return false; end if;
  if not exists (select 1 from public.device_tokens where user_id = p_user) then return false; end if;
  if p_once is not null then
    insert into app.notify_log (user_id, key, created_at) values (p_user, p_once, p_now) on conflict do nothing;
    if not found then return false; end if;
  end if;
  insert into public.notification_outbox (user_id, kind, channel, title, body, data, created_at)
  values (p_user, 'visible', p_channel, p_title, p_body, jsonb_build_object('link', coalesce(p_link, '/')), p_now);
  return true;
end $$;

-- The rest of the actor's crew (Pact signed).
create or replace function app.notify_crew(
  p_actor uuid, p_channel text, p_title text, p_body text, p_link text,
  p_pref text default null, p_once text default null, p_now timestamptz default now()
)
returns int language sql security definer set search_path = ''
as $$
  select count(*)::int from (
    select app.notify(gm.user_id, p_channel, p_title, p_body, p_link, p_pref, p_once, p_now) as sent
      from public.group_members gm
     where gm.group_id = (select group_id from public.group_members where user_id = p_actor)
       and gm.user_id <> p_actor
       and gm.pact_accepted_at is not null
  ) x where x.sent
$$;

create or replace function app.display_name(p_user uuid)
returns text language sql stable security definer set search_path = ''
as $$ select coalesce((select display_name from public.profiles where id = p_user), 'Someone') $$;

-- "3–9 Dec", "28 Dec–3 Jan", "5 Dec"
create or replace function app.date_range_label(p_start date, p_end date)
returns text language sql immutable set search_path = ''
as $$
  select case
    when p_start = p_end then to_char(p_start, 'FMDD Mon')
    when date_trunc('month', p_start) = date_trunc('month', p_end) then to_char(p_start, 'FMDD') || '–' || to_char(p_end, 'FMDD Mon')
    else to_char(p_start, 'FMDD Mon') || '–' || to_char(p_end, 'FMDD Mon')
  end
$$;

-- -----------------------------------------------------------------------------
-- Check-in events: missed (self + crew), freeze used (crew), friend checked in
-- (crew, opt-in). Honest slips are never announced as slips (CLAUDE.md rule 3).
-- -----------------------------------------------------------------------------
create or replace function app.on_checkin_notify()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := app.display_name(new.user_id);
  v_day text := to_char(new.local_date, 'YYYY-MM-DD');
begin
  if new.status = 'missed' then
    perform app.notify(new.user_id, 'reminders', '📉 Missed check-in',
      'Your streak reset. Lock back in tonight 💪', '/history', 'reminders', 'missed:' || v_day);
    perform app.notify_crew(new.user_id, 'group', '🤡 ' || v_name || ' missed a check-in',
      'Streak gone. Let them hear about it.', '/profile/' || new.user_id, 'group', 'missed:' || new.user_id || ':' || v_day);
  elsif new.status = 'frozen' then
    perform app.notify_crew(new.user_id, 'group', '🧊 ' || v_name || ' used a freeze token',
      'Streak saved… this time.', '/profile/' || new.user_id, 'group', 'frozen:' || new.user_id || ':' || v_day);
  elsif new.status in ('clean', 'relapse') and new.source <> 'system' then
    perform app.notify_crew(new.user_id, 'group', '✅ ' || v_name || ' checked in',
      'Your move.', '/leaderboard', 'friend_checkins', 'checkin:' || new.user_id || ':' || v_day);
  end if;
  return null;
end $$;

create trigger checkins_notify after insert on public.checkins
  for each row execute function app.on_checkin_notify();

-- -----------------------------------------------------------------------------
-- Rank ups and streak milestones (crew). A rank up wins when both happen at once.
-- Once-keys include the date the streak got there, so undo → redo can't resend.
-- -----------------------------------------------------------------------------
create or replace function app.on_stats_notify()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_milestone int;
  v_day text := coalesce(to_char(new.last_checkin_date, 'YYYY-MM-DD'), 'none');
begin
  if new.current_streak <= old.current_streak then return null; end if;
  v_name := app.display_name(new.user_id);

  if new.rank is distinct from old.rank then
    perform app.notify_crew(new.user_id, 'group', '⬆️ ' || v_name || ' reached ' || new.rank,
      'Rank up. Keep up or get left behind.', '/profile/' || new.user_id, 'group', 'rank:' || new.rank || ':' || v_day);
    return null;
  end if;

  select max(m) into v_milestone from unnest(app.streak_milestones()) m
   where m > old.current_streak and m <= new.current_streak;
  if v_milestone is not null then
    perform app.notify_crew(new.user_id, 'group', '🔥 ' || v_name || ' hit a ' || v_milestone || '-day streak',
      'Absolutely locked in.', '/profile/' || new.user_id, 'group', 'streak:' || v_milestone || ':' || v_day);
  end if;
  return null;
end $$;

create trigger user_stats_notify after update of current_streak on public.user_stats
  for each row execute function app.on_stats_notify();

-- -----------------------------------------------------------------------------
-- Vacation booked (crew).
-- -----------------------------------------------------------------------------
create or replace function app.on_vacation_notify()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform app.notify_crew(new.user_id, 'group', '🏝️ ' || app.display_name(new.user_id) || ' is on vacation ' || app.date_range_label(new.start_date, new.end_date),
    'Their streak is paused, not broken.', '/profile/' || new.user_id, 'group', 'vacation:' || new.id);
  return null;
end $$;

create trigger vacations_notify after insert on public.vacations
  for each row execute function app.on_vacation_notify();

-- -----------------------------------------------------------------------------
-- app.send_reminders (SPEC §18.2), every 15 minutes:
--   • daily reminder once local time passes reminder_time (never before check-in opens)
--     and you haven't checked in today;
--   • final warning FINAL_WARNING_HOURS before yesterday's deadline if yesterday is still open.
-- Uses "time has passed + not sent yet today" rather than an exact 15-minute slot,
-- so a late or skipped cron run never loses a reminder.
-- -----------------------------------------------------------------------------
create or replace function app.send_reminders(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = ''
as $$
declare
  m record;
  v_today date;
  v_time time;
  v_sent int := 0;
  v_opens time := app.cfg_text('CHECKIN_OPENS_AT')::time;
  v_warn_at time := (interval '24 hours' - make_interval(hours => app.cfg_int('FINAL_WARNING_HOURS')))::time;
begin
  for m in
    select gm.user_id, gm.first_eligible_date, p.timezone, p.reminder_time
      from public.group_members gm join public.profiles p on p.id = gm.user_id
     where gm.pact_accepted_at is not null and gm.first_eligible_date is not null
       and exists (select 1 from public.device_tokens d where d.user_id = gm.user_id)
  loop
    v_today := app.local_today(m.timezone, p_now);
    v_time := app.local_time(m.timezone, p_now);

    -- Daily reminder
    if v_today >= m.first_eligible_date
       and v_time >= greatest(m.reminder_time, v_opens)
       and not exists (select 1 from public.checkins c where c.user_id = m.user_id and c.local_date = v_today)
       and not exists (select 1 from public.vacations v where v.user_id = m.user_id and v.cancelled_at is null and v_today between v.start_date and v.end_date)
       and app.notify(m.user_id, 'reminders', '🔒 Lock in.', 'Check in for today.', '/', 'reminders', 'reminder:' || v_today, p_now)
    then
      v_sent := v_sent + 1;
    end if;

    -- Final warning for yesterday
    if v_today - 1 >= m.first_eligible_date
       and v_time >= v_warn_at
       and not exists (select 1 from public.checkins c where c.user_id = m.user_id and c.local_date = v_today - 1)
       and not exists (select 1 from public.vacations v where v.user_id = m.user_id and v.cancelled_at is null and v_today - 1 between v.start_date and v.end_date)
       and app.notify(m.user_id, 'reminders', '⏰ ' || app.cfg_int('FINAL_WARNING_HOURS') || ' hours left',
             'Check in for yesterday… or it counts as missed.', '/', 'reminders', 'final:' || (v_today - 1), p_now)
    then
      v_sent := v_sent + 1;
    end if;
  end loop;
  return v_sent;
end $$;

select cron.schedule('lockinin-send-reminders', '*/15 * * * *', $$select app.send_reminders()$$);

-- -----------------------------------------------------------------------------
-- Preferences RPCs
-- -----------------------------------------------------------------------------
create or replace function app.set_notify_prefs_impl(p_user uuid, p_prefs jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  k text;
  v jsonb;
  v_merged jsonb;
begin
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' then perform app.fail('NOTIFY_PREFS_INVALID'); end if;
  for k, v in select * from jsonb_each(p_prefs) loop
    if not (app.notify_pref_defaults() ? k) or jsonb_typeof(v) <> 'boolean' then perform app.fail('NOTIFY_PREFS_INVALID'); end if;
  end loop;
  update public.profiles set notify_prefs = notify_prefs || p_prefs where id = p_user
  returning notify_prefs into v_merged;
  return app.notify_pref_defaults() || v_merged;
end $$;

create or replace function public.set_notify_prefs(p_prefs jsonb)
returns jsonb language sql security definer set search_path = ''
as $$ select app.set_notify_prefs_impl(app.require_uid(), p_prefs) $$;

-- Your effective prefs (defaults filled in) and reminder time.
create or replace function public.get_notify_prefs()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'prefs', app.notify_pref_defaults() || p.notify_prefs,
    'reminder_time', to_char(p.reminder_time, 'HH24:MI')
  ) from public.profiles p where p.id = app.require_uid()
$$;

revoke all on function
  app.notify(uuid, text, text, text, text, text, text, timestamptz),
  app.notify_crew(uuid, text, text, text, text, text, text, timestamptz),
  app.send_reminders(timestamptz),
  app.set_notify_prefs_impl(uuid, jsonb)
from public, anon, authenticated;
revoke all on function public.set_notify_prefs(jsonb), public.get_notify_prefs() from public, anon;
grant execute on function public.set_notify_prefs(jsonb), public.get_notify_prefs() to authenticated;

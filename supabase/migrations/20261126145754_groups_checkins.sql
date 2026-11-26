-- =============================================================================
-- Lockin' In — M1: groups, membership, check-ins, private notes, seasons.
--
-- Client-callable RPCs live in `public` and are thin wrappers around `app.*_impl`
-- functions. The impls take the user and an injectable `p_now` so pgTAP tests
-- can control time; the public wrappers always pass auth.uid() and now(), so a
-- client can never fake the clock.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Config: replaces app.config() to add GROUP_NAME_MAX_LENGTH (parity test reads
-- the latest definition).
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

-- -----------------------------------------------------------------------------
-- Time & validation helpers
-- -----------------------------------------------------------------------------
create or replace function app.is_valid_timezone(p_tz text)
returns boolean language sql stable set search_path = ''
as $$ select p_tz is not null and exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) $$;

create or replace function app.local_today(p_tz text, p_now timestamptz)
returns date language sql stable set search_path = ''
as $$ select (p_now at time zone p_tz)::date $$;

create or replace function app.local_time(p_tz text, p_now timestamptz)
returns time language sql stable set search_path = ''
as $$ select (p_now at time zone p_tz)::time $$;

create or replace function app.require_uid()
returns uuid language plpgsql stable set search_path = ''
as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001'; end if;
  return v;
end $$;

-- Raises a stable, machine-readable error key (the app maps keys to friendly copy).
create or replace function app.fail(p_key text)
returns void language plpgsql volatile set search_path = ''
as $$ begin raise exception '%', p_key using errcode = 'P0001'; end $$;

-- Trims and validates a user-visible name (shows on the widget, so the discretion rule applies).
create or replace function app.clean_name(p_name text, p_max int)
returns text language plpgsql stable set search_path = ''
as $$
declare v text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if char_length(v) < 1 or char_length(v) > p_max then perform app.fail('INVALID_NAME'); end if;
  if app.contains_forbidden_word(v) then perform app.fail('FORBIDDEN_WORD'); end if;
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- Tables (SPEC §16)
-- -----------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  timezone text not null default app.cfg_text('DEFAULT_TIMEZONE'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  pact_accepted_at timestamptz,
  first_eligible_date date,                     -- local date of pact acceptance
  primary key (group_id, user_id),
  unique (user_id)                               -- v1: one group per user
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  local_date date not null,
  status public.checkin_status not null,
  points int not null default 0,
  streak_after int not null default 0,
  source public.checkin_source not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);
create index checkins_group_date_idx on public.checkins (group_id, local_date);

create table public.checkin_notes (              -- private: author-only RLS
  checkin_id uuid primary key references public.checkins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(note) <= 500)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  number int not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  results jsonb,
  unique (group_id, number)
);

-- -----------------------------------------------------------------------------
-- Row Level Security (SPEC §17)
-- -----------------------------------------------------------------------------
create or replace function app.my_group_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select gm.group_id from public.group_members gm where gm.user_id = auth.uid() $$;
grant execute on function app.my_group_id() to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_notes enable row level security;
alter table public.seasons enable row level security;
revoke all on public.groups, public.group_members, public.checkins, public.checkin_notes, public.seasons from anon;

create policy groups_select_member on public.groups
  for select to authenticated using (id = (select app.my_group_id()));
create policy group_members_select_member on public.group_members
  for select to authenticated using (group_id = (select app.my_group_id()));
create policy checkins_select_member on public.checkins
  for select to authenticated using (group_id = (select app.my_group_id()));
create policy seasons_select_member on public.seasons
  for select to authenticated using (group_id = (select app.my_group_id()));

-- Private notes: only ever the author (select/insert/update/delete).
create policy checkin_notes_author on public.checkin_notes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = (select auth.uid()))
  );

-- Profiles: yourself + members of your group.
drop policy profiles_select_own on public.profiles;
create policy profiles_select_group on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select gm.user_id from public.group_members gm where gm.group_id = (select app.my_group_id()))
  );

-- -----------------------------------------------------------------------------
-- update_profile (SPEC §18.1) — onboarding steps 3–4 and Settings.
-- Every argument is optional; null means "leave unchanged".
-- -----------------------------------------------------------------------------
create or replace function public.update_profile(
  p_display_name text default null,
  p_avatar_id text default null,
  p_timezone text default null,
  p_reminder_time time default null,
  p_auto_use_freeze boolean default null,
  p_phone text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.require_uid();
  v_row public.profiles;
begin
  select * into v_row from public.profiles where id = v_uid for update;
  if not found then perform app.fail('PROFILE_NOT_FOUND'); end if;

  if p_display_name is not null then
    v_row.display_name := app.clean_name(p_display_name, app.cfg_int('DISPLAY_NAME_MAX_LENGTH'));
  end if;
  if p_avatar_id is not null then
    if p_avatar_id !~ '^[a-z0-9-]{1,32}$' then perform app.fail('INVALID_AVATAR'); end if;
    v_row.avatar_id := p_avatar_id;
  end if;
  if p_timezone is not null and p_timezone is distinct from v_row.timezone then
    if not app.is_valid_timezone(p_timezone) then perform app.fail('INVALID_TIMEZONE'); end if;
    v_row.timezone := p_timezone;
    v_row.tz_changed_at := now();               -- finaliser grace period (SPEC §4)
  end if;
  if p_reminder_time is not null then v_row.reminder_time := p_reminder_time; end if;
  if p_auto_use_freeze is not null then v_row.auto_use_freeze := p_auto_use_freeze; end if;
  if p_phone is not null then
    v_row.phone := nullif(btrim(p_phone), '');
    if v_row.phone is not null and v_row.phone !~ '^\+?[0-9 ()-]{6,20}$' then perform app.fail('INVALID_PHONE'); end if;
  end if;

  update public.profiles set
    display_name = v_row.display_name, avatar_id = v_row.avatar_id, timezone = v_row.timezone,
    tz_changed_at = v_row.tz_changed_at, reminder_time = v_row.reminder_time,
    auto_use_freeze = v_row.auto_use_freeze, phone = v_row.phone
  where id = v_uid;

  return to_jsonb(v_row);
end $$;

-- -----------------------------------------------------------------------------
-- Groups: create / join / pact
-- -----------------------------------------------------------------------------
create or replace function app.new_invite_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare
  v_alpha text := app.cfg_text('INVITE_CODE_ALPHABET');
  v_len int := app.cfg_int('INVITE_CODE_LENGTH');
  v_code text;
begin
  loop
    select string_agg(substr(v_alpha, 1 + floor(random() * char_length(v_alpha))::int, 1), '')
      into v_code from generate_series(1, v_len);
    exit when not exists (select 1 from public.groups where invite_code = v_code);
  end loop;
  return v_code;
end $$;

create or replace function app.create_group_impl(p_user uuid, p_name text, p_timezone text, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := app.clean_name(p_name, app.cfg_int('GROUP_NAME_MAX_LENGTH'));
  v_tz text := coalesce(p_timezone, (select timezone from public.profiles where id = p_user), app.cfg_text('DEFAULT_TIMEZONE'));
  v_group public.groups;
  v_month date;
begin
  if exists (select 1 from public.group_members where user_id = p_user) then perform app.fail('ALREADY_IN_GROUP'); end if;
  if not app.is_valid_timezone(v_tz) then perform app.fail('INVALID_TIMEZONE'); end if;

  insert into public.groups (name, invite_code, timezone, created_by, created_at)
  values (v_name, app.new_invite_code(), v_tz, p_user, p_now)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role, joined_at)
  values (v_group.id, p_user, 'owner', p_now);

  -- Season 1 = the current calendar month in the group's timezone (SPEC §8.5).
  v_month := date_trunc('month', app.local_today(v_tz, p_now))::date;
  insert into public.seasons (group_id, number, starts_on, ends_on)
  values (v_group.id, 1, v_month, (v_month + interval '1 month - 1 day')::date);

  return jsonb_build_object('group_id', v_group.id, 'name', v_group.name, 'invite_code', v_group.invite_code);
end $$;

create or replace function public.create_group(p_name text, p_timezone text default null)
returns jsonb language sql security definer set search_path = ''
as $$ select app.create_group_impl(app.require_uid(), p_name, p_timezone, now()) $$;

create or replace function app.join_group_impl(p_user uuid, p_invite_code text, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_invite_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_group public.groups;
begin
  if exists (select 1 from public.group_members where user_id = p_user) then perform app.fail('ALREADY_IN_GROUP'); end if;
  select * into v_group from public.groups where invite_code = v_code;
  if not found then perform app.fail('INVITE_NOT_FOUND'); end if;

  insert into public.group_members (group_id, user_id, role, joined_at)
  values (v_group.id, p_user, 'member', p_now);

  return jsonb_build_object('group_id', v_group.id, 'name', v_group.name, 'invite_code', v_group.invite_code);
end $$;

create or replace function public.join_group(p_invite_code text)
returns jsonb language sql security definer set search_path = ''
as $$ select app.join_group_impl(app.require_uid(), p_invite_code, now()) $$;

-- Idempotent: accepting twice keeps the original date.
create or replace function app.accept_pact_impl(p_user uuid, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text := (select timezone from public.profiles where id = p_user);
  v_member public.group_members;
begin
  select * into v_member from public.group_members where user_id = p_user for update;
  if not found then perform app.fail('NOT_IN_GROUP'); end if;
  if v_member.pact_accepted_at is null then
    update public.group_members
      set pact_accepted_at = p_now, first_eligible_date = app.local_today(v_tz, p_now)
      where user_id = p_user
      returning * into v_member;
  end if;
  return jsonb_build_object('pact_accepted_at', v_member.pact_accepted_at, 'first_eligible_date', v_member.first_eligible_date);
end $$;

create or replace function public.accept_pact()
returns jsonb language sql security definer set search_path = ''
as $$ select app.accept_pact_impl(app.require_uid(), now()) $$;

-- -----------------------------------------------------------------------------
-- check_in (SPEC §4, §5)
--   * clean for today only from CHECKIN_OPENS_AT (local); yesterday any time today
--   * an honest slip can be logged for today at any time (see docs/DECISIONS.md)
--   * clean → slipped always allowed in the window; slipped → clean only within
--     UNDO_WINDOW_MINUTES; missed/frozen/vacation are system-only and locked
-- Scoring (points, streaks) is recomputed from M2 onward.
-- -----------------------------------------------------------------------------
create or replace function app.check_in_impl(
  p_user uuid,
  p_local_date date,
  p_status public.checkin_status,
  p_note text,
  p_source public.checkin_source,
  p_now timestamptz
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text;
  v_member public.group_members;
  v_today date;
  v_source public.checkin_source := coalesce(p_source, 'app');
  v_existing public.checkins;
  v_row public.checkins;
begin
  select timezone into v_tz from public.profiles where id = p_user;
  select * into v_member from public.group_members where user_id = p_user;
  if not found then perform app.fail('NOT_IN_GROUP'); end if;
  if v_member.pact_accepted_at is null then perform app.fail('PACT_NOT_ACCEPTED'); end if;
  if p_status is null or p_status not in ('clean', 'relapse') then perform app.fail('INVALID_STATUS'); end if;
  if v_source = 'system' then perform app.fail('INVALID_SOURCE'); end if;

  v_today := app.local_today(v_tz, p_now);
  if p_local_date is null or p_local_date > v_today then perform app.fail('DATE_IN_FUTURE'); end if;
  if p_local_date < v_today - 1 then perform app.fail('WINDOW_CLOSED'); end if;
  if p_local_date < v_member.first_eligible_date then perform app.fail('BEFORE_FIRST_ELIGIBLE'); end if;
  if p_local_date = v_today and p_status = 'clean'
     and app.local_time(v_tz, p_now) < app.cfg_text('CHECKIN_OPENS_AT')::time then
    perform app.fail('CHECKIN_NOT_OPEN');
  end if;
  if p_local_date = v_today - 1 and v_source = 'app' then v_source := 'backfill'; end if;

  select * into v_existing from public.checkins
    where user_id = p_user and local_date = p_local_date for update;

  if found then
    if v_existing.status in ('missed', 'frozen', 'vacation') then perform app.fail('LOCKED'); end if;
    if v_existing.status = 'relapse' and p_status = 'clean'
       and p_now > v_existing.updated_at + make_interval(mins => app.cfg_int('UNDO_WINDOW_MINUTES')) then
      perform app.fail('UNDO_EXPIRED');
    end if;
    if v_existing.status <> p_status then
      update public.checkins set status = p_status, source = v_source, updated_at = p_now
        where id = v_existing.id returning * into v_row;
    else
      v_row := v_existing;
    end if;
  else
    insert into public.checkins (user_id, group_id, local_date, status, source, created_at, updated_at)
    values (p_user, v_member.group_id, p_local_date, p_status, v_source, p_now, p_now)
    returning * into v_row;
  end if;

  -- Private note: null = leave as is, blank = remove.
  if p_note is not null then
    if char_length(p_note) > app.cfg_int('CHECKIN_NOTE_MAX_LENGTH') then perform app.fail('NOTE_TOO_LONG'); end if;
    if btrim(p_note) = '' then
      delete from public.checkin_notes where checkin_id = v_row.id;
    else
      insert into public.checkin_notes (checkin_id, user_id, note) values (v_row.id, p_user, btrim(p_note))
      on conflict (checkin_id) do update set note = excluded.note;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_row.id, 'local_date', v_row.local_date, 'status', v_row.status,
    'source', v_row.source, 'created_at', v_row.created_at, 'updated_at', v_row.updated_at
  );
end $$;

create or replace function public.check_in(
  p_local_date date,
  p_status public.checkin_status,
  p_note text default null,
  p_source public.checkin_source default 'app'
)
returns jsonb language sql security definer set search_path = ''
as $$ select app.check_in_impl(app.require_uid(), p_local_date, p_status, p_note, p_source, now()) $$;

-- Misclick undo for a slip, within UNDO_WINDOW_MINUTES: a fresh slip is removed,
-- a slip that replaced a clean check-in goes back to clean.
create or replace function app.undo_slip_impl(p_user uuid, p_local_date date, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_row public.checkins;
begin
  select * into v_row from public.checkins
    where user_id = p_user and local_date = p_local_date for update;
  if not found or v_row.status <> 'relapse' then perform app.fail('NOTHING_TO_UNDO'); end if;
  if p_now > v_row.updated_at + make_interval(mins => app.cfg_int('UNDO_WINDOW_MINUTES')) then
    perform app.fail('UNDO_EXPIRED');
  end if;
  if v_row.created_at = v_row.updated_at then
    delete from public.checkins where id = v_row.id;
    return jsonb_build_object('local_date', p_local_date, 'status', null);
  end if;
  update public.checkins set status = 'clean', updated_at = p_now where id = v_row.id;
  return jsonb_build_object('local_date', p_local_date, 'status', 'clean');
end $$;

create or replace function public.undo_slip(p_local_date date)
returns jsonb language sql security definer set search_path = ''
as $$ select app.undo_slip_impl(app.require_uid(), p_local_date, now()) $$;

-- -----------------------------------------------------------------------------
-- get_home (SPEC §18.1): everything the Home screen (and onboarding gate) needs.
-- -----------------------------------------------------------------------------
create or replace function app.day_json(p_user uuid, p_date date)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'status', c.status, 'source', c.source, 'created_at', c.created_at, 'updated_at', c.updated_at,
    'note', (select n.note from public.checkin_notes n where n.checkin_id = c.id)
  )
  from public.checkins c where c.user_id = p_user and c.local_date = p_date
$$;

create or replace function app.get_home_impl(p_user uuid, p_now timestamptz)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_member public.group_members;
  v_group public.groups;
  v_today date;
  v_group_json jsonb := null;
  v_season jsonb := null;
  v_members jsonb := '[]'::jsonb;
begin
  select * into v_profile from public.profiles where id = p_user;
  if not found then perform app.fail('PROFILE_NOT_FOUND'); end if;
  v_today := app.local_today(v_profile.timezone, p_now);

  select * into v_member from public.group_members where user_id = p_user;
  if found then
    select * into v_group from public.groups where id = v_member.group_id;
    v_group_json := jsonb_build_object(
      'id', v_group.id, 'name', v_group.name, 'invite_code', v_group.invite_code,
      'timezone', v_group.timezone, 'role', v_member.role,
      'pact_accepted_at', v_member.pact_accepted_at, 'first_eligible_date', v_member.first_eligible_date
    );
    select jsonb_build_object('number', s.number, 'starts_on', s.starts_on, 'ends_on', s.ends_on)
      into v_season
      from public.seasons s where s.group_id = v_group.id and s.status = 'active'
      order by s.number desc limit 1;
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'avatar_id', p.avatar_id,
        'is_me', p.id = p_user, 'pact_accepted', gm.pact_accepted_at is not null,
        'checked_today', exists (
          select 1 from public.checkins c
          where c.user_id = p.id and c.local_date = app.local_today(p.timezone, p_now)
        )
      ) order by gm.joined_at), '[]'::jsonb)
      into v_members
      from public.group_members gm join public.profiles p on p.id = gm.user_id
      where gm.group_id = v_group.id;
  end if;

  return jsonb_build_object(
    'now', p_now,
    'me', jsonb_build_object(
      'id', v_profile.id, 'display_name', v_profile.display_name, 'avatar_id', v_profile.avatar_id,
      'timezone', v_profile.timezone, 'reminder_time', to_char(v_profile.reminder_time, 'HH24:MI')
    ),
    'today_local', v_today,
    'yesterday_local', v_today - 1,
    'local_time', to_char(app.local_time(v_profile.timezone, p_now), 'HH24:MI'),
    'opens_at', app.cfg_text('CHECKIN_OPENS_AT'),
    'undo_minutes', app.cfg_int('UNDO_WINDOW_MINUTES'),
    'group', v_group_json,
    'season', v_season,
    'today', app.day_json(p_user, v_today),
    'yesterday', app.day_json(p_user, v_today - 1),
    'members', v_members
  );
end $$;

create or replace function public.get_home()
returns jsonb language sql stable security definer set search_path = ''
as $$ select app.get_home_impl(app.require_uid(), now()) $$;

-- -----------------------------------------------------------------------------
-- Grants: only these RPCs are callable by signed-in users.
-- -----------------------------------------------------------------------------
grant execute on function
  public.update_profile(text, text, text, time, boolean, text),
  public.create_group(text, text),
  public.join_group(text),
  public.accept_pact(),
  public.check_in(date, public.checkin_status, text, public.checkin_source),
  public.undo_slip(date),
  public.get_home()
to authenticated;

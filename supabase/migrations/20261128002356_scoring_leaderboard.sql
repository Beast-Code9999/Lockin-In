-- =============================================================================
-- Lockin' In — M2: scoring, stats, finaliser, freeze tokens, vacations, leaderboard.
-- SQL is the source of truth for scoring (CLAUDE.md rule 6). src/shared/scoring.ts
-- mirrors app.score_sequence() and both are tested against fixtures/scoring/*.json.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables (SPEC §16)
-- -----------------------------------------------------------------------------
create table public.user_stats (                 -- cache, recomputed from checkins
  user_id uuid primary key references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  score_30d int not null default 0,
  season_points int not null default 0,
  rank text not null default 'Rookie',
  flame_tier int not null default 0,
  last_checkin_date date,
  freeze_tokens_left int not null default 2,
  freeze_tokens_month text,                       -- 'YYYY-MM'
  reroll_used_season_id uuid,
  clown_until timestamptz,
  coward_until timestamptz,
  urges_defeated int not null default 0,
  wingman_count int not null default 0,
  challenges_done int not null default 0,
  boxes_completed int not null default 0,
  badge_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.vacations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index vacations_user_idx on public.vacations (user_id, start_date);

alter table public.user_stats enable row level security;
alter table public.vacations enable row level security;
revoke all on public.user_stats, public.vacations from anon;

create policy user_stats_select_member on public.user_stats
  for select to authenticated using (group_id = (select app.my_group_id()));
create policy vacations_select_member on public.vacations
  for select to authenticated
  using (user_id in (select gm.user_id from public.group_members gm where gm.group_id = (select app.my_group_id())));

-- -----------------------------------------------------------------------------
-- Pure scoring core (SPEC §7). Statuses in date order → points + streak per row.
--   clean    +1 streak, BASE + ceil(min(streak, CAP) / DIVISOR)
--   relapse  streak 0, 0 pts          missed  streak 0, MISSED_POINTS
--   frozen / vacation: streak paused (unchanged), 0 pts
-- -----------------------------------------------------------------------------
create or replace function app.score_sequence(p_statuses public.checkin_status[])
returns table (idx int, points int, streak_after int)
language plpgsql immutable set search_path = ''
as $$
declare
  v_streak int := 0;
  v_base int := app.cfg_int('BASE_POINTS');
  v_cap int := app.cfg_int('STREAK_BONUS_CAP_DAYS');
  v_div int := app.cfg_int('STREAK_BONUS_DIVISOR');
  v_missed int := app.cfg_int('MISSED_POINTS');
  i int;
  v_status public.checkin_status;
begin
  for i in 1 .. coalesce(array_length(p_statuses, 1), 0) loop
    v_status := p_statuses[i];
    if v_status = 'clean' then
      v_streak := v_streak + 1;
      points := v_base + ceil(least(v_streak, v_cap)::numeric / v_div)::int;
    elsif v_status = 'relapse' then
      v_streak := 0; points := 0;
    elsif v_status = 'missed' then
      v_streak := 0; points := v_missed;
    else
      points := 0;                                   -- frozen / vacation pause the streak
    end if;
    idx := i;
    streak_after := v_streak;
    return next;
  end loop;
end $$;

-- Ranks & flames (SPEC §8.1–8.2). Mirrors src/shared/ranks.ts (boundaries tested on both sides).
create or replace function app.rank_for_streak(p_streak int)
returns text language sql immutable set search_path = ''
as $$
  select case
    when p_streak >= 60 then 'Final Boss'
    when p_streak >= 30 then 'Monk Mode'
    when p_streak >= 14 then 'Disciplined'
    when p_streak >= 7 then 'Locked In'
    when p_streak >= 3 then 'Grinder'
    else 'Rookie'
  end
$$;

create or replace function app.flame_tier_for_streak(p_streak int)
returns int language sql immutable set search_path = ''
as $$
  select case when p_streak >= 60 then 4 when p_streak >= 30 then 3 when p_streak >= 7 then 2 when p_streak >= 1 then 1 else 0 end
$$;

-- Season = calendar month in the group's timezone (SPEC §8.5), numbered from the
-- group's first season. Derived from the clock so it stays right before the M7 rollover job exists.
create or replace function app.current_season(p_group uuid, p_now timestamptz)
returns table (number int, starts_on date, ends_on date)
language sql stable set search_path = ''
as $$
  with m as (
    select date_trunc('month', app.local_today(g.timezone, p_now))::date as month_start
    from public.groups g where g.id = p_group
  ), f as (
    select min(s.starts_on) as first_start from public.seasons s where s.group_id = p_group
  )
  select
    ((extract(year from m.month_start) - extract(year from coalesce(f.first_start, m.month_start))) * 12
      + extract(month from m.month_start) - extract(month from coalesce(f.first_start, m.month_start)))::int + 1,
    m.month_start,
    (m.month_start + interval '1 month - 1 day')::date
  from m, f
$$;

-- -----------------------------------------------------------------------------
-- recompute_user_stats (SPEC §7.5): rewrites points/streak_after for every row,
-- then the cached user_stats row. Cheap: a few hundred rows per player at most.
-- -----------------------------------------------------------------------------
create or replace function app.recompute_user_stats(p_user uuid, p_now timestamptz)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text;
  v_group uuid;
  v_today date;
  v_ids uuid[];
  v_statuses public.checkin_status[];
  v_current int := 0;
  v_longest int := 0;
  v_last date;
  v_score int := 0;
  v_season_points int := 0;
  v_season record;
begin
  select p.timezone into v_tz from public.profiles p where p.id = p_user;
  select gm.group_id into v_group from public.group_members gm where gm.user_id = p_user;
  if v_group is null then return; end if;
  v_today := app.local_today(v_tz, p_now);

  select array_agg(c.id order by c.local_date), array_agg(c.status order by c.local_date)
    into v_ids, v_statuses
    from public.checkins c where c.user_id = p_user;

  update public.checkins c
     set points = s.points, streak_after = s.streak_after
    from app.score_sequence(coalesce(v_statuses, '{}')) s
   where c.id = v_ids[s.idx]
     and (c.points, c.streak_after) is distinct from (s.points, s.streak_after);

  select coalesce(max(c.streak_after), 0) into v_longest from public.checkins c where c.user_id = p_user;
  select c.streak_after, c.local_date into v_current, v_last
    from public.checkins c where c.user_id = p_user order by c.local_date desc limit 1;
  select greatest(0, coalesce(sum(c.points), 0)) into v_score
    from public.checkins c
   where c.user_id = p_user and c.local_date between v_today - (app.cfg_int('SCORE_WINDOW_DAYS') - 1) and v_today;

  select * into v_season from app.current_season(v_group, p_now);
  select coalesce(sum(c.points), 0) into v_season_points
    from public.checkins c
   where c.user_id = p_user and c.local_date between v_season.starts_on and v_season.ends_on;
  -- M5 subtracts FAILED_FORFEIT_SEASON_PENALTY per failed box this season.

  v_current := coalesce(v_current, 0);
  insert into public.user_stats as us
    (user_id, group_id, current_streak, longest_streak, score_30d, season_points, rank, flame_tier, last_checkin_date, updated_at)
  values
    (p_user, v_group, v_current, v_longest, v_score, v_season_points,
     app.rank_for_streak(v_current), app.flame_tier_for_streak(v_current), v_last, p_now)
  on conflict (user_id) do update set
    group_id = excluded.group_id,
    current_streak = excluded.current_streak,
    longest_streak = greatest(us.longest_streak, excluded.longest_streak),
    score_30d = excluded.score_30d,
    season_points = excluded.season_points,
    rank = excluded.rank,
    flame_tier = excluded.flame_tier,
    last_checkin_date = excluded.last_checkin_date,
    updated_at = excluded.updated_at;
end $$;

-- -----------------------------------------------------------------------------
-- Freeze tokens (SPEC §6): FREEZE_TOKENS_PER_MONTH, lazily reset each user-local month, no rollover.
-- -----------------------------------------------------------------------------
create or replace function app.refresh_freeze_tokens(p_user uuid, p_now timestamptz)
returns int language plpgsql security definer set search_path = ''
as $$
declare
  v_month text := to_char(app.local_today((select timezone from public.profiles where id = p_user), p_now), 'YYYY-MM');
  v_left int;
begin
  update public.user_stats
     set freeze_tokens_left = app.cfg_int('FREEZE_TOKENS_PER_MONTH'), freeze_tokens_month = v_month
   where user_id = p_user and freeze_tokens_month is distinct from v_month;
  select freeze_tokens_left into v_left from public.user_stats where user_id = p_user;
  return coalesce(v_left, 0);
end $$;

create or replace function app.take_freeze_token(p_user uuid, p_now timestamptz)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  perform app.refresh_freeze_tokens(p_user, p_now);
  update public.user_stats set freeze_tokens_left = freeze_tokens_left - 1
   where user_id = p_user and freeze_tokens_left > 0;
  return found;
end $$;

-- -----------------------------------------------------------------------------
-- Check-in hooks: keep the M1 logic, recompute stats after every change.
-- (Renaming the M1 impls keeps this migration append-only without copying them.)
-- -----------------------------------------------------------------------------
alter function app.check_in_impl(uuid, date, public.checkin_status, text, public.checkin_source, timestamptz) rename to check_in_core;
alter function app.undo_slip_impl(uuid, date, timestamptz) rename to undo_slip_core;
alter function app.accept_pact_impl(uuid, timestamptz) rename to accept_pact_core;

create or replace function app.check_in_impl(
  p_user uuid, p_local_date date, p_status public.checkin_status, p_note text, p_source public.checkin_source, p_now timestamptz
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v jsonb;
begin
  v := app.check_in_core(p_user, p_local_date, p_status, p_note, p_source, p_now);
  perform app.recompute_user_stats(p_user, p_now);
  return v || coalesce((
    select jsonb_build_object('points', c.points, 'streak_after', c.streak_after)
    from public.checkins c where c.id = (v ->> 'id')::uuid
  ), '{}'::jsonb);
end $$;

create or replace function app.undo_slip_impl(p_user uuid, p_local_date date, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v jsonb;
begin
  v := app.undo_slip_core(p_user, p_local_date, p_now);
  perform app.recompute_user_stats(p_user, p_now);
  return v;
end $$;

-- accept_pact also creates the user_stats row (SPEC §18.1).
create or replace function app.accept_pact_impl(p_user uuid, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v jsonb;
begin
  v := app.accept_pact_core(p_user, p_now);
  perform app.recompute_user_stats(p_user, p_now);
  perform app.refresh_freeze_tokens(p_user, p_now);
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- Finaliser (SPEC §4, §18.2). For every unlogged day whose deadline has passed
-- (end of D+1 local, i.e. D <= today-2): vacation → freeze token → missed.
-- Skips players for TZ_CHANGE_GRACE_HOURS after a timezone change. Recomputes
-- everyone each run, which also slides the 30-day window.
-- Mystery Boxes for missed days arrive in M5.
-- -----------------------------------------------------------------------------
create or replace function app.finalize_missed_days(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = ''
as $$
declare
  m record;
  d date;
  v_status public.checkin_status;
  v_created int := 0;
begin
  for m in
    select gm.user_id, gm.group_id, gm.first_eligible_date, p.timezone, p.tz_changed_at, p.auto_use_freeze
      from public.group_members gm join public.profiles p on p.id = gm.user_id
     where gm.pact_accepted_at is not null and gm.first_eligible_date is not null
  loop
    insert into public.user_stats (user_id, group_id) values (m.user_id, m.group_id) on conflict (user_id) do nothing;

    if m.tz_changed_at is null or m.tz_changed_at <= p_now - make_interval(hours => app.cfg_int('TZ_CHANGE_GRACE_HOURS')) then
      for d in
        select gs::date
          from generate_series(m.first_eligible_date, app.local_today(m.timezone, p_now) - 2, interval '1 day') gs
         where not exists (select 1 from public.checkins c where c.user_id = m.user_id and c.local_date = gs::date)
         order by 1
      loop
        if exists (
          select 1 from public.vacations v
           where v.user_id = m.user_id and v.cancelled_at is null and d between v.start_date and v.end_date
        ) then
          v_status := 'vacation';
        elsif m.auto_use_freeze and app.take_freeze_token(m.user_id, p_now) then
          v_status := 'frozen';
        else
          v_status := 'missed';
        end if;
        insert into public.checkins (user_id, group_id, local_date, status, source, created_at, updated_at)
        values (m.user_id, m.group_id, d, v_status, 'system', p_now, p_now)
        on conflict (user_id, local_date) do nothing;
        v_created := v_created + 1;
      end loop;
    end if;

    perform app.recompute_user_stats(m.user_id, p_now);
  end loop;
  return v_created;
end $$;

-- -----------------------------------------------------------------------------
-- Vacations (SPEC §6): book in advance (start >= tomorrow), max VACATION_MAX_RANGE_DAYS
-- per booking and VACATION_MAX_DAYS_PER_30 in any rolling 30-day window, no overlaps.
-- -----------------------------------------------------------------------------
create or replace function app.set_vacation_impl(p_user uuid, p_start date, p_end date, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := app.local_today((select timezone from public.profiles where id = p_user), p_now);
  v_max30 int := app.cfg_int('VACATION_MAX_DAYS_PER_30');
  v_row public.vacations;
begin
  if not exists (select 1 from public.group_members where user_id = p_user) then perform app.fail('NOT_IN_GROUP'); end if;
  if p_start is null or p_end is null or p_end < p_start then perform app.fail('VACATION_INVALID'); end if;
  if p_start < v_today + 1 then perform app.fail('VACATION_TOO_SOON'); end if;
  if p_end - p_start + 1 > app.cfg_int('VACATION_MAX_RANGE_DAYS') then perform app.fail('VACATION_TOO_LONG'); end if;
  if exists (
    select 1 from public.vacations v
     where v.user_id = p_user and v.cancelled_at is null and v.start_date <= p_end and v.end_date >= p_start
  ) then perform app.fail('VACATION_OVERLAP'); end if;

  -- Every 30-day window touching the new range must stay within the limit.
  if exists (
    select 1
      from generate_series(p_start - 29, p_end, interval '1 day') w(ws)
     where (
       select count(*) from (
         select gs::date from public.vacations v,
           generate_series(greatest(v.start_date, w.ws::date), least(v.end_date, w.ws::date + 29), interval '1 day') gs
          where v.user_id = p_user and v.cancelled_at is null
         union
         select gs::date from generate_series(greatest(p_start, w.ws::date), least(p_end, w.ws::date + 29), interval '1 day') gs
       ) days
     ) > v_max30
  ) then perform app.fail('VACATION_LIMIT'); end if;

  insert into public.vacations (user_id, start_date, end_date, created_at) values (p_user, p_start, p_end, p_now)
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- Cancel: only the future is cancelled; days already under way stay as booked.
create or replace function app.cancel_vacation_impl(p_user uuid, p_id uuid, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := app.local_today((select timezone from public.profiles where id = p_user), p_now);
  v_row public.vacations;
begin
  select * into v_row from public.vacations where id = p_id and user_id = p_user and cancelled_at is null for update;
  if not found then perform app.fail('VACATION_NOT_FOUND'); end if;
  if v_row.end_date <= v_today then perform app.fail('VACATION_ALREADY_OVER'); end if;
  if v_row.start_date > v_today then
    update public.vacations set cancelled_at = p_now where id = p_id returning * into v_row;
  else
    update public.vacations set end_date = v_today where id = p_id returning * into v_row;
  end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.set_vacation(p_start date, p_end date)
returns jsonb language sql security definer set search_path = ''
as $$ select app.set_vacation_impl(app.require_uid(), p_start, p_end, now()) $$;

create or replace function public.cancel_vacation(p_id uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select app.cancel_vacation_impl(app.require_uid(), p_id, now()) $$;

-- -----------------------------------------------------------------------------
-- Rival callout (SPEC §12.2): the person just above you on the 30-day score.
-- -----------------------------------------------------------------------------
create or replace function app.rival_text(p_user uuid)
returns text language sql stable security definer set search_path = ''
as $$
  with board as (
    select us.user_id, p.display_name, us.score_30d,
           row_number() over (order by us.score_30d desc, us.current_streak desc, p.display_name) as pos
      from public.user_stats us
      join public.group_members gm on gm.user_id = us.user_id and gm.pact_accepted_at is not null
      join public.profiles p on p.id = us.user_id
     where us.group_id = (select group_id from public.group_members where user_id = p_user)
  ), me as (select * from board where user_id = p_user)
  select case
    when (select count(*) from board) < 2 or not exists (select 1 from me) then null
    when me.pos = 1 then
      case
        when me.score_30d = (select score_30d from board where pos = 2)
          then 'Dead level with ' || (select display_name from board where pos = 2) || ' — break the tie tonight 🔥'
        else 'Top of the board — ' || (me.score_30d - (select score_30d from board where pos = 2)) || ' pts clear of '
             || (select display_name from board where pos = 2) || ' 👑'
      end
    else
      case
        when me.score_30d = (select score_30d from board where pos = me.pos - 1)
          then 'Level with ' || (select display_name from board where pos = me.pos - 1) || ' — edge ahead tonight 🎯'
        else ((select score_30d from board where pos = me.pos - 1) - me.score_30d) || ' pts to catch '
             || (select display_name from board where pos = me.pos - 1) || ' 🎯'
      end
  end
  from me
  right join (select 1) one on true
$$;

-- -----------------------------------------------------------------------------
-- get_home v2: adds stats, season (from the clock), rival, member stats, vacations.
-- -----------------------------------------------------------------------------
create or replace function app.stats_json(p_user uuid, p_now timestamptz)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'current_streak', coalesce(us.current_streak, 0),
    'longest_streak', coalesce(us.longest_streak, 0),
    'score_30d', coalesce(us.score_30d, 0),
    'season_points', coalesce(us.season_points, 0),
    'rank', coalesce(us.rank, 'Rookie'),
    'flame_tier', coalesce(us.flame_tier, 0),
    -- Tokens reset lazily; show the fresh allowance if the stored month is stale.
    'freeze_tokens_left', case
      when us.freeze_tokens_month is distinct from
           to_char(app.local_today((select timezone from public.profiles where id = p_user), p_now), 'YYYY-MM')
      then app.cfg_int('FREEZE_TOKENS_PER_MONTH')
      else us.freeze_tokens_left end
  )
  from (select 1) one left join public.user_stats us on us.user_id = p_user
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
  v_vacations jsonb := '[]'::jsonb;
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
    select jsonb_build_object('number', s.number, 'starts_on', s.starts_on, 'ends_on', s.ends_on,
                              'days_left', s.ends_on - app.local_today(v_group.timezone, p_now))
      into v_season from app.current_season(v_group.id, p_now) s;
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'avatar_id', p.avatar_id,
        'is_me', p.id = p_user, 'pact_accepted', gm.pact_accepted_at is not null,
        'checked_today', exists (
          select 1 from public.checkins c
           where c.user_id = p.id and c.local_date = app.local_today(p.timezone, p_now)
        ),
        'on_vacation_today', exists (
          select 1 from public.vacations v
           where v.user_id = p.id and v.cancelled_at is null
             and app.local_today(p.timezone, p_now) between v.start_date and v.end_date
        ),
        'stats', app.stats_json(p.id, p_now)
      ) order by gm.joined_at), '[]'::jsonb)
      into v_members
      from public.group_members gm join public.profiles p on p.id = gm.user_id
     where gm.group_id = v_group.id;
    select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'start_date', v.start_date, 'end_date', v.end_date)
                              order by v.start_date), '[]'::jsonb)
      into v_vacations
      from public.vacations v
     where v.user_id = p_user and v.cancelled_at is null and v.end_date >= v_today;
  end if;

  return jsonb_build_object(
    'now', p_now,
    'me', jsonb_build_object(
      'id', v_profile.id, 'display_name', v_profile.display_name, 'avatar_id', v_profile.avatar_id,
      'timezone', v_profile.timezone, 'reminder_time', to_char(v_profile.reminder_time, 'HH24:MI'),
      'auto_use_freeze', v_profile.auto_use_freeze
    ),
    'today_local', v_today,
    'yesterday_local', v_today - 1,
    'local_time', to_char(app.local_time(v_profile.timezone, p_now), 'HH24:MI'),
    'opens_at', app.cfg_text('CHECKIN_OPENS_AT'),
    'undo_minutes', app.cfg_int('UNDO_WINDOW_MINUTES'),
    'group', v_group_json,
    'season', v_season,
    'stats', app.stats_json(p_user, p_now),
    'rival', app.rival_text(p_user),
    'today', app.day_json(p_user, v_today),
    'yesterday', app.day_json(p_user, v_today - 1),
    'members', v_members,
    'vacations', v_vacations
  );
end $$;

grant execute on function public.set_vacation(date, date), public.cancel_vacation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Schedule (SPEC §18.2): finalise hourly at :05 UTC (logic converts to each player's local day).
-- The daily recompute job is folded in: every run recomputes everyone.
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('lockinin-finalize-missed-days', '5 * * * *', $$select app.finalize_missed_days(now())$$);

-- Backfill stats for players who joined before M2.
select app.recompute_user_stats(gm.user_id, now()), app.refresh_freeze_tokens(gm.user_id, now())
  from public.group_members gm where gm.pact_accepted_at is not null;

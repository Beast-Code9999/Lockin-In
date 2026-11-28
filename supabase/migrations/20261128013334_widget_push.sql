-- =============================================================================
-- Lockin' In — M3: widget snapshot, device tokens, notification outbox, push.
--
-- Push path (SPEC §18.3): anything that changes game state inserts into
-- notification_outbox → a statement trigger pokes the `send-push` Edge Function
-- via pg_net → the function drains unsent rows to FCM HTTP v1.
-- The function takes no input and only drains the outbox, so it's deployed
-- without JWT verification; calling it can't do anything except deliver queued pushes.
-- =============================================================================

create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- Tables (SPEC §16)
-- -----------------------------------------------------------------------------
create table public.device_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('visible', 'data')),
  channel text,                                    -- reminders | group | boxes | sos
  title text,
  body text,
  data jsonb not null default '{}'::jsonb,
  collapse_key text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create index notification_outbox_unsent_idx on public.notification_outbox (id) where sent_at is null and error is null;

create table public.group_events (               -- feed for the widget's "last event" line
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index group_events_group_idx on public.group_events (group_id, created_at desc);

-- Runtime settings that differ per environment (not secrets).
create table app.settings (key text primary key, value text);
insert into app.settings (key, value)
values ('push_function_url', 'https://jelghnelksbphzqzxuwe.supabase.co/functions/v1/send-push');

alter table public.device_tokens enable row level security;
alter table public.notification_outbox enable row level security;   -- no policies: no client access
alter table public.group_events enable row level security;
revoke all on public.device_tokens, public.notification_outbox, public.group_events from anon;
revoke all on public.notification_outbox from authenticated;

create policy device_tokens_own on public.device_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy device_tokens_delete_own on public.device_tokens
  for delete to authenticated using (user_id = (select auth.uid()));
create policy group_events_select_member on public.group_events
  for select to authenticated using (group_id = (select app.my_group_id()));

-- -----------------------------------------------------------------------------
-- register_device (SPEC §18.1): upsert this phone's FCM token for the caller.
-- -----------------------------------------------------------------------------
create or replace function public.register_device(p_token text, p_platform text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.require_uid();
begin
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 4096 then perform app.fail('INVALID_TOKEN'); end if;
  if p_platform not in ('android', 'ios') then perform app.fail('INVALID_PLATFORM'); end if;
  insert into public.device_tokens (token, user_id, platform, updated_at)
  values (p_token, v_uid, p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- -----------------------------------------------------------------------------
-- Silent "group_updated" refresh for every member with a device (SPEC §12.6).
-- Deduped: skip anyone who already has an unsent refresh queued.
-- -----------------------------------------------------------------------------
create or replace function app.enqueue_group_refresh(p_group uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into public.notification_outbox (user_id, kind, data, collapse_key)
  select gm.user_id, 'data', jsonb_build_object('type', 'group_updated'), 'group_updated'
    from public.group_members gm
   where gm.group_id = p_group
     and exists (select 1 from public.device_tokens d where d.user_id = gm.user_id)
     and not exists (
       select 1 from public.notification_outbox o
        where o.user_id = gm.user_id and o.collapse_key = 'group_updated' and o.sent_at is null and o.error is null
     );
$$;

-- Statement-level triggers with transition tables, so a finaliser run that touches
-- many rows queues one refresh per member, not one per row. (A transition table only
-- exists for the events that declare it, hence one small function per event.)
create or replace function app.refresh_groups_new()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform app.enqueue_group_refresh(x.group_id) from (select distinct group_id from new_rows) x where x.group_id is not null;
  return null;
end $$;

create or replace function app.refresh_groups_old()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform app.enqueue_group_refresh(x.group_id) from (select distinct group_id from old_rows) x where x.group_id is not null;
  return null;
end $$;

create trigger checkins_refresh_ins after insert on public.checkins
  referencing new table as new_rows for each statement execute function app.refresh_groups_new();
create trigger checkins_refresh_upd after update on public.checkins
  referencing new table as new_rows for each statement execute function app.refresh_groups_new();
create trigger checkins_refresh_del after delete on public.checkins
  referencing old table as old_rows for each statement execute function app.refresh_groups_old();
create trigger group_members_refresh_ins after insert on public.group_members
  referencing new table as new_rows for each statement execute function app.refresh_groups_new();
create trigger group_members_refresh_upd after update on public.group_members
  referencing new table as new_rows for each statement execute function app.refresh_groups_new();

-- Name/avatar/vacation changes show on other phones' widgets too.
create or replace function app.refresh_group_of_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := case when tg_op = 'DELETE' then (to_jsonb(old) ->> case when tg_table_name = 'profiles' then 'id' else 'user_id' end)::uuid
                            else (to_jsonb(new) ->> case when tg_table_name = 'profiles' then 'id' else 'user_id' end)::uuid end;
begin
  perform app.enqueue_group_refresh(gm.group_id) from public.group_members gm where gm.user_id = v_user;
  return null;
end $$;

create trigger profiles_refresh after update of display_name, avatar_id on public.profiles
  for each row execute function app.refresh_group_of_user();
create trigger vacations_refresh after insert or update on public.vacations
  for each row execute function app.refresh_group_of_user();

-- -----------------------------------------------------------------------------
-- Delivery: poke the Edge Function once per statement that queues pushes.
-- -----------------------------------------------------------------------------
create or replace function app.kick_push()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_url text := (select value from app.settings where key = 'push_function_url');
begin
  if v_url is null or v_url = '' then return; end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
end $$;

-- The Edge Function claims a batch atomically (sent_at = claim time) so two
-- overlapping runs never send the same push; failures are recorded in `error`.
create or replace function public.claim_outbox(p_limit int default 100)
returns setof public.notification_outbox language sql security definer set search_path = ''
as $$
  update public.notification_outbox o set sent_at = now()
   where o.id in (
     select id from public.notification_outbox
      where sent_at is null and error is null
      order by id
      limit least(greatest(p_limit, 1), 500)
      for update skip locked
   )
  returning o.*;
$$;
revoke execute on function public.claim_outbox(int) from public, anon, authenticated;
grant execute on function public.claim_outbox(int) to service_role;

create or replace function app.on_outbox_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform app.kick_push();
  return null;
end $$;

create trigger notification_outbox_kick after insert on public.notification_outbox
  for each statement execute function app.on_outbox_insert();

-- Safety net: if a poke was lost, sweep every 5 minutes while anything is unsent.
select cron.schedule(
  'lockinin-push-sweep', '*/5 * * * *',
  $$select app.kick_push() where exists (select 1 from public.notification_outbox where sent_at is null and error is null and created_at > now() - interval '1 day')$$
);

-- -----------------------------------------------------------------------------
-- get_widget_snapshot (SPEC §12.5): everything the home-screen widget renders.
-- The server decides positions, statuses and rival text so every phone agrees;
-- the client adds avatar layer keys and XP (pure mirrors) before caching it.
-- -----------------------------------------------------------------------------
create or replace function app.today_status(p_user uuid, p_now timestamptz)
returns text language sql stable security definer set search_path = ''
as $$
  -- Box / coward / clown states arrive with M5.
  select case
    when c.status in ('clean', 'relapse') then 'checked'
    when c.status = 'frozen' then 'frozen'
    when c.status = 'vacation' then 'vacation'
    when exists (
      select 1 from public.vacations v
       where v.user_id = p_user and v.cancelled_at is null
         and app.local_today(p.timezone, p_now) between v.start_date and v.end_date
    ) then 'vacation'
    else 'pending'
  end
  from public.profiles p
  left join public.checkins c on c.user_id = p.id and c.local_date = app.local_today(p.timezone, p_now)
  where p.id = p_user
$$;

create or replace function app.get_widget_snapshot_impl(p_user uuid, p_now timestamptz)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_member public.group_members;
  v_group public.groups;
  v_today date;
  v_season jsonb := null;
  v_members jsonb := '[]'::jsonb;
  v_event jsonb := null;
begin
  select * into v_profile from public.profiles where id = p_user;
  if not found then perform app.fail('PROFILE_NOT_FOUND'); end if;
  v_today := app.local_today(v_profile.timezone, p_now);
  select * into v_member from public.group_members where user_id = p_user;

  if found and v_member.pact_accepted_at is not null then
    select * into v_group from public.groups where id = v_member.group_id;
    select jsonb_build_object('number', s.number, 'endsOn', s.ends_on, 'daysLeft', s.ends_on - app.local_today(v_group.timezone, p_now))
      into v_season from app.current_season(v_group.id, p_now) s;

    select coalesce(jsonb_agg(m order by (m ->> 'position')::int), '[]'::jsonb) into v_members
    from (
      select jsonb_build_object(
        'uid', p.id,
        'name', p.display_name,
        'avatarId', p.avatar_id,
        'score30d', coalesce(us.score_30d, 0),
        'seasonPoints', coalesce(us.season_points, 0),
        'streak', coalesce(us.current_streak, 0),
        'flameTier', coalesce(us.flame_tier, 0),
        'rank', coalesce(us.rank, 'Rookie'),
        'todayStatus', app.today_status(p.id, p_now),
        'position', row_number() over (order by coalesce(us.score_30d, 0) desc, coalesce(us.current_streak, 0) desc, p.display_name)
      ) as m
      from public.group_members gm
      join public.profiles p on p.id = gm.user_id
      left join public.user_stats us on us.user_id = gm.user_id
      where gm.group_id = v_group.id and gm.pact_accepted_at is not null
    ) rows;

    select jsonb_build_object('text', e.payload ->> 'text', 'at', e.created_at) into v_event
      from public.group_events e where e.group_id = v_group.id and e.payload ? 'text'
      order by e.created_at desc limit 1;
  end if;

  return jsonb_build_object(
    'version', 1,
    'generatedAt', p_now,
    'me', jsonb_build_object(
      'uid', p_user,
      'todayLocal', v_today,
      'localTime', to_char(app.local_time(v_profile.timezone, p_now), 'HH24:MI'),
      'checkinOpensAt', app.cfg_text('CHECKIN_OPENS_AT'),
      'inGame', v_member.pact_accepted_at is not null,
      'checkedInToday', exists (select 1 from public.checkins c where c.user_id = p_user and c.local_date = v_today),
      'yesterdayPending', v_member.first_eligible_date is not null
        and v_today - 1 >= v_member.first_eligible_date
        and not exists (select 1 from public.checkins c where c.user_id = p_user and c.local_date = v_today - 1),
      'owedBoxId', null
    ),
    'season', v_season,
    'members', v_members,
    'rival', case when app.rival_text(p_user) is null then null else jsonb_build_object('text', app.rival_text(p_user)) end,
    'activeSos', null,
    'lastEvent', v_event
  );
end $$;

create or replace function public.get_widget_snapshot()
returns jsonb language sql stable security definer set search_path = ''
as $$ select app.get_widget_snapshot_impl(app.require_uid(), now()) $$;

grant execute on function public.register_device(text, text), public.get_widget_snapshot() to authenticated;

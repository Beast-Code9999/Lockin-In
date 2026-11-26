-- =============================================================================
-- Lockin' In — M0 foundations
--
-- Layout (see docs/DECISIONS.md):
--   * schema `app`    — internals: config, validation helpers, triggers, jobs.
--                        Not exposed by PostgREST; EXECUTE is granted case by case.
--   * schema `public` — tables (RLS on every one) and client-callable RPCs
--                        (SECURITY DEFINER, search_path pinned). Clients never
--                        write game tables directly.
-- Migrations are append-only: never edit this file once applied — add a new one.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

create schema if not exists app;
grant usage on schema app to authenticated, service_role;

-- Functions created from here on are not callable by anon / PUBLIC unless granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema app revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enums (SPEC §16). `relapse` is internal only — the UI always says "Slipped".
-- -----------------------------------------------------------------------------
create type public.checkin_status as enum ('clean', 'relapse', 'missed', 'frozen', 'vacation');
create type public.checkin_source as enum ('app', 'widget', 'backfill', 'system');
create type public.rarity as enum ('common', 'rare', 'epic', 'legendary');
create type public.post_type as enum ('story', 'feed', 'profile_pic');
create type public.box_status as enum ('owed', 'opened', 'proof_submitted', 'confirmed', 'failed');
create type public.vote_kind as enum ('confirm', 'reject');
create type public.sos_outcome as enum ('held', 'relapsed', 'abandoned');
create type public.loot_status as enum ('pending', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Tunable constants (SPEC §20). Mirrors CONFIG in src/shared/constants.ts —
-- tests/constantsParity.test.ts parses the block between the markers below,
-- so keep exactly one `'KEY', value` pair per line.
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
    'CHECKIN_NOTE_MAX_LENGTH', 500,
    'LOOT_CAPTION_MAX_LENGTH', 220,
    'LOOT_PROMPT_MAX_LENGTH', 140,
    'SOS_MESSAGE_MAX_LENGTH', 140,
    'INVITE_CODE_LENGTH', 6,
    'INVITE_CODE_ALPHABET', 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    -- @config-end
  );
$$;

create or replace function app.cfg(p_key text)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v jsonb := app.config() -> p_key;
begin
  if v is null then
    raise exception 'Unknown config key %', p_key using errcode = 'P0001';
  end if;
  return v;
end;
$$;

create or replace function app.cfg_int(p_key text)
returns integer language sql immutable parallel safe set search_path = ''
as $$ select (app.cfg(p_key) #>> '{}')::integer $$;

create or replace function app.cfg_numeric(p_key text)
returns numeric language sql immutable parallel safe set search_path = ''
as $$ select (app.cfg(p_key) #>> '{}')::numeric $$;

create or replace function app.cfg_text(p_key text)
returns text language sql immutable parallel safe set search_path = ''
as $$ select app.cfg(p_key) #>> '{}' $$;

-- -----------------------------------------------------------------------------
-- Discretion (SPEC §3). Mirrors src/shared/forbiddenWords.ts — the parity test
-- parses the array between the markers. Matching rule (same in TS):
--   normalise (split camelCase, strip accents, lowercase), then each term must
--   start at a word boundary; separators (space . _ -) may appear between the
--   words of a phrase; everything after the start is a prefix match.
-- -----------------------------------------------------------------------------
create or replace function app.forbidden_words()
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select array[
    -- @forbidden-begin
    'nofap', 'no fap', 'fap', 'porn', 'masturbat*', 'semen',
    'retention', 'nnn', 'no nut', 'coom*', 'goon*', 'edging'
    -- @forbidden-end
  ]::text[];
$$;

create or replace function app.normalise_for_word_check(p_text text)
returns text
language sql
stable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent(regexp_replace(coalesce(p_text, ''), '([a-z])([A-Z])', '\1 \2', 'g')));
$$;

create or replace function app.contains_forbidden_word(p_text text)
returns boolean
language sql
stable
parallel safe
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(app.forbidden_words()) as w(term)
    where app.normalise_for_word_check(p_text)
      ~ ('(^|[^a-z0-9])' || replace(rtrim(w.term, '*'), ' ', '[[:space:]._-]*'))
  );
$$;

-- -----------------------------------------------------------------------------
-- Profiles (SPEC §16). One row per auth user, created by a trigger on sign-up.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar_id text not null default app.cfg_text('DEFAULT_AVATAR_ID') check (avatar_id ~ '^[a-z0-9-]{1,32}$'),
  timezone text not null default app.cfg_text('DEFAULT_TIMEZONE'),
  tz_changed_at timestamptz,
  reminder_time time not null default app.cfg_text('DEFAULT_REMINDER_TIME')::time,
  auto_use_freeze boolean not null default true,
  phone text,                                   -- optional, for "Call me"
  notify_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'One per auth user. Clients read via RLS; writes go through RPCs (update_profile, M1).';

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;

-- M0: you can read your own profile. M1 widens this to members of your group.
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

-- First name from the identity provider (Google full_name), else the email's local part.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(split_part(btrim(new.raw_user_meta_data ->> 'full_name'), ' ', 1), ''),
    nullif(split_part(btrim(new.raw_user_meta_data ->> 'name'), ' ', 1), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Player'
  );
  v_name := btrim(left(v_name, app.cfg_int('DISPLAY_NAME_MAX_LENGTH')));
  if v_name = '' then
    v_name := 'Player';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

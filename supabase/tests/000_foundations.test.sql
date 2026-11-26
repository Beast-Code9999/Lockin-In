-- pgTAP: M0 foundations — enums, config, discretion check, profiles + RLS.
-- Run with `supabase test db`. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- ---------------------------------------------------------------- helpers
create schema tests;

create function tests.create_user(p_email text, p_meta jsonb default '{}'::jsonb)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (v_id, p_email, p_meta, 'authenticated', 'authenticated');
  return v_id;
end $$;

create function tests.authenticate_as(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.clear_authentication()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', null, true);
  execute 'reset role';
end $$;

grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------------------------------------------------------------- schema + enums
select has_schema('app', 'app schema exists');
select enum_has_labels('public', 'checkin_status', array['clean', 'relapse', 'missed', 'frozen', 'vacation'], 'checkin_status labels');
select enum_has_labels('public', 'checkin_source', array['app', 'widget', 'backfill', 'system'], 'checkin_source labels');
select enum_has_labels('public', 'rarity', array['common', 'rare', 'epic', 'legendary'], 'rarity labels');
select enum_has_labels('public', 'post_type', array['story', 'feed', 'profile_pic'], 'post_type labels');
select enum_has_labels('public', 'box_status', array['owed', 'opened', 'proof_submitted', 'confirmed', 'failed'], 'box_status labels');
select enum_has_labels('public', 'vote_kind', array['confirm', 'reject'], 'vote_kind labels');
select enum_has_labels('public', 'sos_outcome', array['held', 'relapsed', 'abandoned'], 'sos_outcome labels');
select enum_has_labels('public', 'loot_status', array['pending', 'approved', 'rejected'], 'loot_status labels');

-- ---------------------------------------------------------------- config (SPEC §20)
select is(app.cfg_int('BASE_POINTS'), 10, 'BASE_POINTS = 10');
select is(app.cfg_int('MISSED_POINTS'), -5, 'MISSED_POINTS = -5 (missed is worse than a slip)');
select is(app.cfg_text('CHECKIN_OPENS_AT'), '17:00', 'check-in opens at 17:00 local');
select is(app.cfg_numeric('LEGENDARY_WILDCARD_CHANCE'), 0.25::numeric, 'wildcard chance = 0.25');
select throws_ok($$ select app.cfg_int('NOT_A_REAL_KEY') $$, 'P0001', 'Unknown config key NOT_A_REAL_KEY', 'unknown config keys raise');

-- ---------------------------------------------------------------- discretion (SPEC §3)
-- @forbidden-begin (test inputs; the repo discretion scan skips this block)
select ok(app.contains_forbidden_word('Day 12 of #NoFap'), 'catches camelCase hashtag');
select ok(app.contains_forbidden_word('no-fap gang'), 'catches hyphenated phrase');
select ok(app.contains_forbidden_word('MASTURBATION'), 'catches wildcard term, any case');
select ok(app.contains_forbidden_word('ex-gooner'), 'catches wildcard after punctuation');
select ok(app.contains_forbidden_word('pörn'), 'catches accented spelling');
select ok(not app.contains_forbidden_word('Meet me in the basement'), 'basement is fine (word-start rule)');
select ok(not app.contains_forbidden_word('Hedging my bets at the lagoon'), 'hedging / lagoon are fine');
select ok(not app.contains_forbidden_word('Hold the line 🛡️'), 'normal copy passes');
-- @forbidden-end

-- ---------------------------------------------------------------- profiles
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS enabled on profiles');

select tests.create_user('jason@pgtap.test', '{"full_name": "Jason Lay"}') as jason \gset
select tests.create_user('miguel@pgtap.test', '{"name": "Miguel"}') as miguel \gset
select tests.create_user('kenneth.a.really.long.local.part@pgtap.test') as ken \gset

select is((select display_name from public.profiles where id = :'jason'), 'Jason', 'trigger: first name from full_name');
select is((select avatar_id from public.profiles where id = :'jason'), 'blaze', 'trigger: default avatar');
select is((select timezone from public.profiles where id = :'jason'), 'Australia/Darwin', 'trigger: default timezone');
select is((select display_name from public.profiles where id = :'ken'), 'kenneth.a.really.lon', 'trigger: email fallback truncated to 20 chars');

-- RLS: a member sees only their own profile; writes are not allowed directly.
select tests.authenticate_as(:'jason');
select results_eq('select id from public.profiles', array[:'jason'::uuid], 'Jason sees only his own profile');
select throws_ok(
  $$ insert into public.profiles (id, display_name) values (gen_random_uuid(), 'Sneaky') $$,
  '42501', null, 'clients cannot insert profiles directly'
);
update public.profiles set display_name = 'Hacked' where id = :'miguel';
select tests.clear_authentication();
select is((select display_name from public.profiles where id = :'miguel'), 'Miguel', 'clients cannot update other profiles');

set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
reset role;

select * from finish();
rollback;

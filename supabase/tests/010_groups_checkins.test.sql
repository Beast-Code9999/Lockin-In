-- pgTAP: M1 — groups, pact, check-in windows & transitions, notes, RLS.
-- Times are UTC; everyone is in Australia/Darwin (UTC+09:30, no DST).
--   16:59 Darwin on 10 Dec = 2026-12-10 07:29Z · 17:00 = 07:30Z
--   23:58 Darwin on 10 Dec = 2026-12-10 14:28Z · 00:01 on 11 Dec = 14:31Z
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers.psql

select no_plan();

select tests.create_user('jason@pgtap.test', '{"full_name": "Jason"}') as jason \gset
select tests.create_user('miguel@pgtap.test', '{"full_name": "Miguel"}') as miguel \gset
select tests.create_user('ken@pgtap.test', '{"full_name": "Ken"}') as ken \gset
select tests.create_user('outsider@pgtap.test', '{"full_name": "Outsider"}') as outsider \gset

-- ------------------------------------------------------------------ groups
select app.create_group_impl(:'jason', '  The   Crew ', null, '2026-12-01 01:00Z') ->> 'invite_code' as code \gset

select matches(:'code'::text, '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$', 'invite code: 6 chars, no ambiguous characters');
select is((select name from public.groups where invite_code = :'code'), 'The Crew', 'group name is trimmed and squashed');
select is((select role from public.group_members where user_id = :'jason'), 'owner', 'creator is owner');
select results_eq(
  format($$ select number, starts_on, ends_on from public.seasons s join public.group_members gm on gm.group_id = s.group_id
     where gm.user_id = %L $$, :'jason'),
  $$ values (1, '2026-12-01'::date, '2026-12-31'::date) $$,
  'season 1 is the current month in the group timezone'
);
select throws_ok(format($$ select app.create_group_impl(%L, 'Second', null, now()) $$, :'jason'), 'P0001', 'ALREADY_IN_GROUP', 'one group per user');
select throws_ok(format($$ select app.create_group_impl(%L, '   ', null, now()) $$, :'ken'), 'P0001', 'INVALID_NAME', 'blank group name rejected');
-- @forbidden-begin
select throws_ok(format($$ select app.create_group_impl(%L, 'Team NoFap', null, now()) $$, :'ken'), 'P0001', 'FORBIDDEN_WORD', 'forbidden words rejected in group names');
-- @forbidden-end

select is(app.join_group_impl(:'miguel', lower(:'code'), now()) ->> 'name', 'The Crew', 'join is case-insensitive');
select throws_ok(format($$ select app.join_group_impl(%L, 'ZZZZZZ', now()) $$, :'ken'), 'P0001', 'INVITE_NOT_FOUND', 'unknown invite code rejected');
select throws_ok(format($$ select app.join_group_impl(%L, %L, now()) $$, :'jason', :'code'), 'P0001', 'ALREADY_IN_GROUP', 'cannot join twice');
select app.create_group_impl(:'outsider', 'Other Crew', null, now());

-- ------------------------------------------------------------------ pact
select throws_ok(
  format($$ select app.check_in_impl(%L, '2026-12-10', 'clean', null, 'app', '2026-12-10 08:00Z') $$, :'jason'),
  'P0001', 'PACT_NOT_ACCEPTED', 'no check-in before accepting the Pact'
);
select is(app.accept_pact_impl(:'jason', '2026-12-09 03:00Z') ->> 'first_eligible_date', '2026-12-09', 'first eligible date = local date of pact');
select is(app.accept_pact_impl(:'jason', '2026-12-12 03:00Z') ->> 'first_eligible_date', '2026-12-09', 'accepting again keeps the original date');
select app.accept_pact_impl(:'miguel', '2026-12-09 03:00Z');

-- ------------------------------------------------------------------ windows (SPEC §22.1, §22.2, §22.14)
select throws_ok(
  format($$ select app.check_in_impl(%L, '2026-12-10', 'clean', null, 'app', '2026-12-10 07:29Z') $$, :'jason'),
  'P0001', 'CHECKIN_NOT_OPEN', 'clean today at 16:59 local is rejected'
);
select is(app.check_in_impl(:'jason', '2026-12-10', 'clean', null, 'app', '2026-12-10 07:30Z') ->> 'status', 'clean', 'clean today at 17:00 local is accepted');
select is(app.check_in_impl(:'jason', '2026-12-09', 'clean', null, 'app', '2026-12-10 14:28Z') ->> 'source', 'backfill', 'yesterday at 23:58 local is accepted (as a backfill)');
select throws_ok(
  format($$ select app.check_in_impl(%L, '2026-12-09', 'relapse', null, 'app', '2026-12-10 14:31Z') $$, :'jason'),
  'P0001', 'WINDOW_CLOSED', 'yesterday at 00:01 the next day is rejected'
);
select throws_ok(
  format($$ select app.check_in_impl(%L, '2026-12-08', 'clean', null, 'app', '2026-12-09 10:00Z') $$, :'miguel'),
  'P0001', 'BEFORE_FIRST_ELIGIBLE', 'nothing before the first eligible date'
);
select throws_ok(
  format($$ select app.check_in_impl(%L, '2026-12-11', 'clean', null, 'app', '2026-12-10 10:00Z') $$, :'miguel'),
  'P0001', 'DATE_IN_FUTURE', 'no check-ins for future dates'
);
select throws_ok(
  format($$ select app.check_in_impl(%L, '2026-12-10', 'missed', null, 'app', '2026-12-10 10:00Z') $$, :'miguel'),
  'P0001', 'INVALID_STATUS', 'users cannot set system statuses'
);

-- ------------------------------------------------------------------ transitions (SPEC §22.3, §22.4)
select is(app.check_in_impl(:'jason', '2026-12-10', 'relapse', null, 'app', '2026-12-10 08:00Z') ->> 'status', 'relapse', 'clean → slipped is allowed');
select throws_ok(
  format($$ select app.check_in_impl(%L, '2026-12-10', 'clean', null, 'app', '2026-12-10 08:06Z') $$, :'jason'),
  'P0001', 'UNDO_EXPIRED', 'slipped → clean after 6 minutes is rejected'
);
select is(app.check_in_impl(:'jason', '2026-12-10', 'clean', null, 'app', '2026-12-10 08:04Z') ->> 'status', 'clean', 'slipped → clean within 5 minutes is allowed');

select is(app.check_in_impl(:'miguel', '2026-12-10', 'relapse', null, 'app', '2026-12-10 02:00Z') ->> 'status', 'relapse', 'an honest slip can be logged before 5pm');
select is(app.undo_slip_impl(:'miguel', '2026-12-10', '2026-12-10 02:03Z') ->> 'status', null::text, 'undoing a fresh slip removes it');
select is_empty(format($$ select 1 from public.checkins where user_id = %L and local_date = '2026-12-10' $$, :'miguel'), 'the undone slip is gone');
select app.check_in_impl(:'miguel', '2026-12-10', 'relapse', null, 'app', '2026-12-10 03:00Z');
select throws_ok(
  format($$ select app.undo_slip_impl(%L, '2026-12-10', '2026-12-10 03:10Z') $$, :'miguel'),
  'P0001', 'UNDO_EXPIRED', 'undo only works for 5 minutes'
);

insert into public.checkins (user_id, group_id, local_date, status, source)
select :'miguel', group_id, '2026-12-09', 'frozen', 'system' from public.group_members where user_id = :'miguel';
select throws_ok(
  format($$ select app.check_in_impl(%L, '2026-12-09', 'clean', null, 'app', '2026-12-10 09:00Z') $$, :'miguel'),
  'P0001', 'LOCKED', 'system-set days cannot be edited'
);

-- ------------------------------------------------------------------ notes
select app.check_in_impl(:'jason', '2026-12-10', 'clean', '  felt strong today  ', 'app', '2026-12-10 08:05Z');
select is(
  (select n.note from public.checkin_notes n join public.checkins c on c.id = n.checkin_id
   where c.user_id = :'jason' and c.local_date = '2026-12-10'),
  'felt strong today', 'private note is stored (trimmed)'
);

-- ------------------------------------------------------------------ profile updates
select throws_ok($$ select public.update_profile(p_timezone => 'Mars/Olympus') $$, 'P0001', 'NOT_AUTHENTICATED', 'update_profile needs a signed-in user');

-- ------------------------------------------------------------------ RLS (SPEC §22.20)
select tests.authenticate_as(:'miguel');
select ok((select count(*) from public.checkins where user_id = :'jason') > 0, 'group members see each other''s check-ins');
select is_empty(format($$ select 1 from public.checkin_notes n join public.checkins c on c.id = n.checkin_id where c.user_id = %L $$, :'jason'), 'nobody else can read your private notes');
select isnt_empty(format($$ select 1 from public.profiles where id = %L $$, :'jason'), 'group members see each other''s profiles');
select throws_ok(
  format($$ insert into public.checkins (user_id, group_id, local_date, status, source)
            select %L, group_id, '2026-12-11', 'clean', 'app' from public.group_members where user_id = %L $$, :'miguel', :'miguel'),
  '42501', null, 'clients cannot write check-ins directly'
);
select is(public.update_profile(p_display_name => '  Miggy  ') ->> 'display_name', 'Miggy', 'update_profile renames (trimmed)');
select throws_ok($$ select public.update_profile(p_timezone => 'Mars/Olympus') $$, 'P0001', 'INVALID_TIMEZONE', 'invalid timezone rejected');
select ok((public.update_profile(p_timezone => 'Asia/Dili') ->> 'tz_changed_at') is not null, 'changing timezone sets tz_changed_at');
select is(jsonb_array_length(public.get_home() -> 'members'), 2, 'get_home lists the crew');
select tests.clear_authentication();

select tests.authenticate_as(:'jason');
select isnt_empty(format($$ select 1 from public.checkin_notes n join public.checkins c on c.id = n.checkin_id where c.user_id = %L $$, :'jason'), 'authors can read their own notes');
select tests.clear_authentication();

select tests.authenticate_as(:'outsider');
select is_empty(format($$ select 1 from public.checkins where user_id in (%L, %L) $$, :'jason', :'miguel'), 'another group cannot read our check-ins');
select is_empty(format($$ select 1 from public.profiles where id in (%L, %L) $$, :'jason', :'miguel'), 'another group cannot read our profiles');
select is((select count(*)::int from public.groups), 1, 'another group sees only its own group');
select is((select count(*)::int from public.group_members), 1, 'another group sees only its own members');
select tests.clear_authentication();

select * from finish();
rollback;

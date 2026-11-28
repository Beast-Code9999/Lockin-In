-- pgTAP: M2 — recompute, finaliser (vacation → freeze → missed), freeze tokens,
-- vacations, timezone travel, seasons, ranks, rival callout. Darwin is UTC+09:30.
--   Jason  : clean 1–2 Dec, then silent           → frozen 3–4 (tokens), missed 5
--   Miguel : auto-freeze off, never checks in     → missed from 1 Dec
--   Ken    : clean 1 Dec, vacation 2–4, clean 5   → streak 2 (vacation pauses it)
--   Ena    : clean 1 Dec, moves Darwin → Dili     → finaliser waits 24h, no day lost or doubled
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers.psql
select no_plan();

select tests.create_user('jason@pgtap.test', '{"full_name": "Jason"}') as jason \gset
select tests.create_user('miguel@pgtap.test', '{"full_name": "Miguel"}') as miguel \gset
select tests.create_user('ken@pgtap.test', '{"full_name": "Ken"}') as ken \gset
select tests.create_user('ena@pgtap.test', '{"full_name": "Ena"}') as ena \gset

select app.create_group_impl(:'jason', 'Crew', null, '2026-12-01 01:00Z') ->> 'invite_code' as code \gset
select app.join_group_impl(u, :'code', '2026-12-01 01:00Z') from unnest(array[:'miguel', :'ken', :'ena']::uuid[]) u;
select app.accept_pact_impl(u, '2026-12-01 03:00Z') from unnest(array[:'jason', :'miguel', :'ken', :'ena']::uuid[]) u;
update public.profiles set auto_use_freeze = false where id = :'miguel';

-- ------------------------------------------------------------------ ranks & flames (SPEC §8)
select results_eq(
  $$ select app.rank_for_streak(s) from unnest(array[0, 2, 3, 6, 7, 13, 14, 29, 30, 59, 60, 400]) s $$,
  $$ values ('Rookie'), ('Rookie'), ('Grinder'), ('Grinder'), ('Locked In'), ('Locked In'), ('Disciplined'), ('Disciplined'), ('Monk Mode'), ('Monk Mode'), ('Final Boss'), ('Final Boss') $$,
  'rank thresholds match SPEC §8.1'
);
select results_eq(
  $$ select app.flame_tier_for_streak(s) from unnest(array[0, 1, 6, 7, 29, 30, 59, 60]) s $$,
  $$ values (0), (1), (1), (2), (2), (3), (3), (4) $$,
  'flame tiers match SPEC §8.2'
);

-- ------------------------------------------------------------------ check-ins return points
select is((app.check_in_impl(:'jason', '2026-12-01', 'clean', null, 'app', '2026-12-01 08:00Z') ->> 'points')::int, 11, 'a first clean day earns 11');
select is((app.check_in_impl(:'jason', '2026-12-02', 'clean', null, 'app', '2026-12-02 08:00Z') ->> 'streak_after')::int, 2, 'streak builds day on day');
select is((select current_streak from public.user_stats where user_id = :'jason'), 2, 'user_stats recomputed after a check-in');
select app.check_in_impl(:'ken', '2026-12-01', 'clean', null, 'app', '2026-12-01 08:00Z');
select app.check_in_impl(:'ena', '2026-12-01', 'clean', null, 'app', '2026-12-01 08:00Z');

-- ------------------------------------------------------------------ vacations (SPEC §6, §22.12)
select throws_ok(format($$ select app.set_vacation_impl(%L, '2026-12-01', '2026-12-03', '2026-12-01 03:30Z') $$, :'ken'), 'P0001', 'VACATION_TOO_SOON', 'cannot start a vacation today');
select isnt(app.set_vacation_impl(:'ken', '2026-12-02', '2026-12-04', '2026-12-01 03:30Z') ->> 'id', null, 'vacation booked from tomorrow');
select throws_ok(format($$ select app.set_vacation_impl(%L, '2026-12-20', '2026-12-30', '2026-12-01 03:30Z') $$, :'ken'), 'P0001', 'VACATION_TOO_LONG', 'max 10 days per booking');
select throws_ok(format($$ select app.set_vacation_impl(%L, '2026-12-04', '2026-12-05', '2026-12-01 03:30Z') $$, :'ken'), 'P0001', 'VACATION_OVERLAP', 'no overlapping bookings');
select app.set_vacation_impl(:'ken', '2026-12-10', '2026-12-16', '2026-12-01 03:30Z') ->> 'id' as ken_trip \gset
select throws_ok(format($$ select app.set_vacation_impl(%L, '2026-12-20', '2026-12-21', '2026-12-01 03:30Z') $$, :'ken'), 'P0001', 'VACATION_LIMIT', 'max 10 vacation days in any 30-day window');
select app.check_in_impl(:'ken', '2026-12-05', 'clean', null, 'app', '2026-12-05 09:00Z');

-- ------------------------------------------------------------------ timezone travel (SPEC §22.13)
update public.profiles set timezone = 'Asia/Dili', tz_changed_at = '2026-12-03 02:00Z' where id = :'ena';

-- Run 1 — 3 Dec 19:30 Darwin: only 1 Dec is past its deadline.
select app.finalize_missed_days('2026-12-03 10:00Z');
select is((select status::text from public.checkins where user_id = :'miguel' and local_date = '2026-12-01'), 'missed', 'unlogged day past its deadline → missed (freeze auto-use off)');
select is((select count(*)::int from public.checkins where user_id = :'ena'), 1, 'finaliser skips a player within 24h of a timezone change');
select is_empty(format($$ select 1 from public.checkins where user_id = %L and local_date < '2026-12-01' $$, :'miguel'), 'nothing before the first eligible date (SPEC §22.14)');

-- Run 2 — 6 Dec: days up to 4 Dec are finalised.
select app.finalize_missed_days('2026-12-06 03:00Z');
select results_eq(
  format($$ select local_date, status::text from public.checkins where user_id = %L order by local_date $$, :'jason'),
  $$ values ('2026-12-01'::date, 'clean'), ('2026-12-02', 'clean'), ('2026-12-03', 'frozen'), ('2026-12-04', 'frozen') $$,
  'freeze tokens are auto-used before a day counts as missed (SPEC §22.11)'
);
select is((select freeze_tokens_left from public.user_stats where user_id = :'jason'), 0, 'both monthly tokens used');
select is((select current_streak from public.user_stats where user_id = :'jason'), 2, 'frozen days pause the streak');
select results_eq(
  format($$ select status::text from public.checkins where user_id = %L and local_date between '2026-12-02' and '2026-12-04' order by local_date $$, :'ken'),
  $$ values ('vacation'), ('vacation'), ('vacation') $$,
  'vacation days finalise as vacation, not missed'
);
select is((select current_streak from public.user_stats where user_id = :'ken'), 2, 'vacation pauses the streak (SPEC §22.12)');
select results_eq(
  format($$ select local_date, count(*)::int from public.checkins where user_id = %L group by local_date order by local_date $$, :'ena'),
  $$ values ('2026-12-01'::date, 1), ('2026-12-02', 1), ('2026-12-03', 1), ('2026-12-04', 1) $$,
  'after the grace period: no lost day, no double-finalised day'
);

-- Run 3 — 7 Dec: 5 Dec is finalised; tokens are gone so it's missed.
select app.finalize_missed_days('2026-12-07 03:00Z');
select is((select status::text from public.checkins where user_id = :'jason' and local_date = '2026-12-05'), 'missed', 'no tokens left → missed');
select results_eq(
  format($$ select current_streak, longest_streak, score_30d, season_points from public.user_stats where user_id = %L $$, :'jason'),
  $$ values (0, 2, 17, 17) $$,
  'missed: streak resets and -5 applies (11 + 11 + 0 + 0 - 5 = 17)'
);
select is((select score_30d from public.user_stats where user_id = :'miguel'), 0, 'score never goes below zero');
select is(app.finalize_missed_days('2026-12-07 03:00Z'), 0, 'running the finaliser twice creates nothing new');

-- ------------------------------------------------------------------ rival callout
select is(app.rival_text(:'jason'), '5 pts to catch Ken 🎯', 'rival: the player just above you');
select is(app.rival_text(:'ken'), 'Top of the board — 5 pts clear of Jason 👑', 'rival: top of the board');

-- ------------------------------------------------------------------ freeze tokens reset monthly, no rollover
update public.user_stats set freeze_tokens_left = 1, freeze_tokens_month = '2026-12' where user_id = :'ken';
select is(app.refresh_freeze_tokens(:'ken', '2027-01-02 03:00Z'), 2, 'a new month restores 2 tokens (no rollover)');

-- ------------------------------------------------------------------ vacation cancel
select isnt(app.cancel_vacation_impl(:'ken', :'ken_trip', '2026-12-07 03:00Z') ->> 'cancelled_at', null, 'a future vacation can be cancelled');
select throws_ok(format($$ select app.cancel_vacation_impl(%L, %L, now()) $$, :'jason', :'ken_trip'), 'P0001', 'VACATION_NOT_FOUND', 'cannot cancel someone else''s vacation');

-- ------------------------------------------------------------------ seasons (calendar month, group tz)
select results_eq(
  format($$ select number, starts_on, ends_on from app.current_season((select group_id from public.group_members where user_id = %L), '2027-01-05 03:00Z') $$, :'jason'),
  $$ values (2, '2027-01-01'::date, '2027-01-31'::date) $$,
  'season 2 starts with the next month'
);

-- ------------------------------------------------------------------ get_home exposes stats to the crew
select tests.authenticate_as(:'miguel');
select is((public.get_home() -> 'stats' ->> 'score_30d')::int, 0, 'get_home: my stats');
select is(jsonb_array_length(public.get_home() -> 'members'), 4, 'get_home: whole crew');
select ok((select count(*) from public.user_stats) = 4, 'crew stats are readable by members');
select tests.clear_authentication();

select * from finish();
rollback;

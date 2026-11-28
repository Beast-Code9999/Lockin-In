-- pgTAP: widget pack — history strip for the Calendar widget (Darwin, UTC+09:30).
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers.psql
select no_plan();
update app.settings set value = null where key = 'push_function_url';

select tests.create_user('jason@pgtap.test', '{"full_name": "Jason"}') as jason \gset
select tests.create_user('loner@pgtap.test', '{"full_name": "Loner"}') as loner \gset
select app.create_group_impl(:'jason', 'Crew', null, '2026-12-01 01:00Z') ->> 'invite_code' as code \gset
select app.accept_pact_impl(:'jason', '2026-12-01 01:00Z');
update public.profiles set auto_use_freeze = false where id = :'jason';

select app.check_in_impl(:'jason', '2026-12-01', 'clean', null, 'app', '2026-12-01 08:00Z');
select app.check_in_impl(:'jason', '2026-12-02', 'relapse', null, 'app', '2026-12-02 08:00Z');
select app.finalize_missed_days('2026-12-05 01:00Z');   -- Dec 3 missed (local today Dec 5)
select app.check_in_impl(:'jason', '2026-12-04', 'clean', null, 'app', '2026-12-05 01:00Z');

select app.history_strip(:'jason', '2026-12-05 01:00Z') as h \gset
select is(length(:'h'::jsonb ->> 'days'), app.cfg_int('WIDGET_HISTORY_DAYS'), 'one character per day for WIDGET_HISTORY_DAYS days');
select is((:'h'::jsonb ->> 'from')::date, '2026-12-05'::date - (app.cfg_int('WIDGET_HISTORY_DAYS') - 1), 'starts WIDGET_HISTORY_DAYS-1 days before today');
select is(right(:'h'::jsonb ->> 'days', 5), 'csmc-', 'Dec 1–5: clean, slipped, missed, clean, today open');
select is(:'h'::jsonb ->> 'firstEligible', '2026-12-01', 'carries the Pact date');
select is(app.history_strip(:'loner', '2026-12-05 01:00Z') ->> 'firstEligible', null, 'no crew: no eligible date');

-- Snapshot includes it; and still requires a session.
select tests.authenticate_as(:'jason');
select ok(public.get_widget_snapshot() ? 'history', 'get_widget_snapshot carries history');
select tests.clear_authentication();
select throws_ok('select public.get_widget_snapshot()', 'P0001', 'NOT_AUTHENTICATED', 'no session, no snapshot');

select * from finish();
rollback;

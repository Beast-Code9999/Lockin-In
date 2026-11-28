-- pgTAP: M3 — device tokens, group_updated refresh pushes, outbox privacy, widget snapshot.
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers.psql
select no_plan();

-- Don't call the real Edge Function from tests.
update app.settings set value = null where key = 'push_function_url';

select tests.create_user('jason@pgtap.test', '{"full_name": "Jason"}') as jason \gset
select tests.create_user('miguel@pgtap.test', '{"full_name": "Miguel"}') as miguel \gset
select tests.create_user('ken@pgtap.test', '{"full_name": "Ken"}') as ken \gset
select app.create_group_impl(:'jason', 'Crew', null, '2026-12-01 01:00Z') ->> 'invite_code' as code \gset
select app.join_group_impl(u, :'code', '2026-12-01 01:00Z') from unnest(array[:'miguel', :'ken']::uuid[]) u;
select app.accept_pact_impl(u, '2026-12-01 03:00Z') from unnest(array[:'jason', :'miguel', :'ken']::uuid[]) u;

-- ------------------------------------------------------------------ register_device
select tests.authenticate_as(:'jason');
select is(public.register_device('jason-token-aaaaaaaaaaaaaaaaaaaa', 'android') ->> 'ok', 'true', 'a player registers their phone');
select throws_ok($$ select public.register_device('short', 'android') $$, 'P0001', 'INVALID_TOKEN', 'junk tokens rejected');
select throws_ok($$ select public.register_device('jason-token-bbbbbbbbbbbbbbbbbbbb', 'windows') $$, 'P0001', 'INVALID_PLATFORM', 'unknown platforms rejected');
select is((select count(*)::int from public.device_tokens), 1, 'players see only their own tokens');
select throws_ok($$ select * from public.notification_outbox $$, '42501', null, 'the outbox is not readable by clients');
select tests.clear_authentication();

select tests.authenticate_as(:'miguel');
select public.register_device('miguel-token-aaaaaaaaaaaaaaaaaaa', 'android');
select is((select count(*)::int from public.device_tokens), 1, 'Miguel cannot see Jason''s token');
select tests.clear_authentication();

-- ------------------------------------------------------------------ refresh pushes (SPEC §12.6)
delete from public.notification_outbox;
select app.check_in_impl(:'jason', '2026-12-01', 'clean', null, 'app', '2026-12-01 08:00Z');
select results_eq(
  format($$ select user_id, kind, data ->> 'type', collapse_key from public.notification_outbox where user_id in (%L, %L, %L) order by user_id $$, :'jason', :'miguel', :'ken'),
  format($$ select * from (values (%L::uuid, 'data', 'group_updated', 'group_updated'), (%L::uuid, 'data', 'group_updated', 'group_updated')) v order by 1 $$, :'jason', :'miguel'),
  'a check-in queues a silent refresh for every crew member with a phone (Ken has none)'
);
select app.check_in_impl(:'miguel', '2026-12-01', 'clean', null, 'app', '2026-12-01 08:01Z');
select is((select count(*)::int from public.notification_outbox where user_id in (:'jason', :'miguel', :'ken')), 2, 'refreshes are deduped while one is still unsent');
-- (before the finaliser settles Ken's open days)
select is(
  app.get_widget_snapshot_impl(:'ken', '2026-12-02 05:00Z') -> 'me' ->> 'yesterdayPending', 'true',
  'yesterday shows as pending while its window is open'
);
select is(
  (select m ->> 'todayStatus' from jsonb_array_elements(app.get_widget_snapshot_impl(:'jason', '2026-12-01 09:00Z') -> 'members') m where m ->> 'name' = 'Ken'),
  'pending', 'a crew member who hasn''t checked in yet is pending'
);
update public.notification_outbox set sent_at = now();
select app.finalize_missed_days('2026-12-04 03:00Z');
select is((select count(*)::int from public.notification_outbox where sent_at is null and kind = 'data' and user_id in (:'jason', :'miguel', :'ken')), 2, 'a finaliser run queues one refresh per member, not one per row');

-- ------------------------------------------------------------------ widget snapshot (SPEC §12.5)
select tests.authenticate_as(:'jason');
select public.get_widget_snapshot() as snap \gset
select tests.clear_authentication();
select is((:'snap'::jsonb ->> 'version')::int, 1, 'snapshot version 1');
select is(jsonb_array_length(:'snap'::jsonb -> 'members'), 3, 'whole crew in the snapshot');
select is(:'snap'::jsonb -> 'members' -> 0 ->> 'name', 'Jason', 'members are ordered by position');
select is((:'snap'::jsonb -> 'members' -> 0 ->> 'position')::int, 1, 'positions start at 1');

select is(
  app.get_widget_snapshot_impl(:'jason', '2026-12-01 09:00Z') -> 'me' ->> 'checkedInToday', 'true',
  'checked in today'
);
select is(
  app.get_widget_snapshot_impl(:'jason', '2026-12-15 03:00Z') -> 'season' ->> 'daysLeft', '16',
  'season countdown'
);

select * from finish();
rollback;

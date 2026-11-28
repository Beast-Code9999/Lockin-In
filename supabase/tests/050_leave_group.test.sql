-- pgTAP: leave_group (SPEC §1.8, §14.12) — leaving removes your data from the crew,
-- hands over ownership, deletes an empty crew, and never blocks account deletion.
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers.psql
select no_plan();
update app.settings set value = null where key = 'push_function_url';

select tests.create_user('jason@pgtap.test', '{"full_name": "Jason"}') as jason \gset
select tests.create_user('miguel@pgtap.test', '{"full_name": "Miguel"}') as miguel \gset
select tests.create_user('ken@pgtap.test', '{"full_name": "Ken"}') as ken \gset
select tests.create_user('solo@pgtap.test', '{"full_name": "Solo"}') as solo \gset

select app.create_group_impl(:'jason', 'Crew', null, '2026-12-01 01:00Z') ->> 'group_id' as grp \gset
select invite_code as code from public.groups where id = :'grp' \gset
select app.join_group_impl(:'miguel', :'code', '2026-12-01 02:00Z');
select app.join_group_impl(:'ken', :'code', '2026-12-01 03:00Z');
select app.accept_pact_impl(u, '2026-12-01 04:00Z') from unnest(array[:'jason', :'miguel', :'ken']::uuid[]) u;
select app.check_in_impl(u, '2026-12-01', 'clean', null, 'app', '2026-12-01 08:00Z') from unnest(array[:'jason', :'miguel', :'ken']::uuid[]) u;
insert into public.device_tokens (token, user_id, platform) values ('tok-jason', :'jason', 'android');
select app.check_in_impl(:'ken', '2026-12-02', 'relapse', 'rough one', 'app', '2026-12-02 08:00Z');

-- ------------------------------------------------------------------ rejection
select throws_ok(
  format('select app.leave_group_impl(%L, now())', :'solo'),
  'P0001', 'NOT_IN_GROUP', 'you can''t leave a crew you''re not in'
);

-- ------------------------------------------------------------------ a member leaves
update public.notification_outbox set sent_at = now() where sent_at is null;
select is((app.leave_group_impl(:'ken', '2026-12-02 09:00Z') ->> 'group_deleted')::boolean, false, 'the crew survives a member leaving');
select is((select count(*)::int from public.group_members where user_id = :'ken'), 0, 'Ken is out of the crew');
select is((select count(*)::int from public.checkins where user_id = :'ken'), 0, 'his check-ins are gone');
select is((select count(*)::int from public.checkin_notes where user_id = :'ken'), 0, 'and so are his private notes');
select is((select count(*)::int from public.user_stats where user_id = :'ken'), 0, 'and his stats');
select is((select count(*)::int from public.profiles where id = :'ken'), 1, 'his profile stays, so he can join another crew');
select is((select count(*)::int from public.group_members where group_id = :'grp'), 2, 'everyone else stays');
select is(
  (select payload ->> 'text' from public.group_events where group_id = :'grp' order by id desc limit 1),
  'Ken left the crew 👋', 'the crew sees he left'
);
select ok(
  exists (select 1 from public.notification_outbox where user_id = :'jason' and data ->> 'type' = 'group_updated' and sent_at is null),
  'remaining members'' widgets get a refresh push'
);
select lives_ok(format('select app.join_group_impl(%L, %L, ''2026-12-02 10:00Z'')', :'ken', :'code'), 'he can rejoin with a clean slate');
select app.leave_group_impl(:'ken', '2026-12-02 11:00Z');

-- ------------------------------------------------------------------ the owner leaves
select app.leave_group_impl(:'jason', '2026-12-02 12:00Z');
select is((select role from public.group_members where user_id = :'miguel'), 'owner', 'ownership passes to the longest-standing member');
select is((select created_by from public.groups where id = :'grp'), :'miguel'::uuid, 'and the crew records the new owner');

-- ------------------------------------------------------------------ last one out
select is((app.leave_group_impl(:'miguel', '2026-12-02 13:00Z') ->> 'group_deleted')::boolean, true, 'the last member leaving deletes the crew');
select is((select count(*)::int from public.groups where id = :'grp'), 0, 'the crew is gone');

-- ------------------------------------------------------------------ account deletion is never blocked
select app.create_group_impl(:'solo', 'Solo crew', null, '2026-12-03 01:00Z') ->> 'invite_code' as code2 \gset
select app.join_group_impl(:'jason', :'code2', '2026-12-03 02:00Z');
select lives_ok(format('delete from auth.users where id = %L', :'solo'), 'deleting a crew creator''s account works');
select is((select count(*)::int from public.group_members gm join public.groups g on g.id = gm.group_id where g.name = 'Solo crew'), 1, 'and the crew carries on for everyone else');

-- ------------------------------------------------------------------ client access
select tests.authenticate_as(:'jason');
select lives_ok('select public.leave_group()', 'players can call leave_group');
select tests.clear_authentication();
select is((select count(*)::int from public.group_members where user_id = :'jason'), 0, 'leave_group() uses the caller');

select * from finish();
rollback;

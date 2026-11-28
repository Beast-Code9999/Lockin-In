-- pgTAP: M4 notifications (SPEC §13, §18.2). Darwin is UTC+09:30, reminder time 21:00.
--   Jason  : checks in Dec 1, then goes quiet (auto-freeze on)  → freeze notice to crew
--   Miguel : reminders switched off
--   Ken    : friend check-ins on, auto-freeze off              → missed notices
--   Nodev  : no phone registered                                → never queued
begin;
create extension if not exists pgtap with schema extensions;
\ir helpers.psql
select no_plan();
update app.settings set value = null where key = 'push_function_url';
-- send_reminders() scans everyone: hide phones of any non-test players in this database (rolled back).
delete from public.device_tokens where user_id not in (select id from auth.users where email like '%@pgtap.test');

select tests.create_user('jason@pgtap.test', '{"full_name": "Jason"}') as jason \gset
select tests.create_user('miguel@pgtap.test', '{"full_name": "Miguel"}') as miguel \gset
select tests.create_user('ken@pgtap.test', '{"full_name": "Ken"}') as ken \gset
select tests.create_user('nodev@pgtap.test', '{"full_name": "Nodev"}') as nodev \gset

select app.create_group_impl(:'jason', 'Crew', null, '2026-12-01 01:00Z') ->> 'invite_code' as code \gset
select app.join_group_impl(u, :'code', '2026-12-01 01:00Z') from unnest(array[:'miguel', :'ken', :'nodev']::uuid[]) u;
select app.accept_pact_impl(u, '2026-12-01 01:00Z') from unnest(array[:'jason', :'miguel', :'ken', :'nodev']::uuid[]) u;
insert into public.device_tokens (token, user_id, platform)
select 'tok-' || u, u, 'android' from unnest(array[:'jason', :'miguel', :'ken']::uuid[]) u;
update public.profiles set auto_use_freeze = false where id = :'ken';

create temp view visible as
  select o.user_id, o.channel, o.title, o.body, o.data ->> 'link' as link
    from public.notification_outbox o
   where o.kind = 'visible' and o.user_id in (select id from auth.users where email like '%@pgtap.test');
grant select on visible to authenticated;

-- ------------------------------------------------------------------ prefs
select throws_ok(format($$select app.set_notify_prefs_impl(%L, '{"nope": true}')$$, :'miguel'), 'P0001', 'NOTIFY_PREFS_INVALID', 'unknown categories are rejected');
select throws_ok(format($$select app.set_notify_prefs_impl(%L, '{"sos": false}')$$, :'miguel'), 'P0001', 'NOTIFY_PREFS_INVALID', 'SOS can''t be switched off in the app');
select throws_ok(format($$select app.set_notify_prefs_impl(%L, '{"group": "no"}')$$, :'miguel'), 'P0001', 'NOTIFY_PREFS_INVALID', 'values must be true/false');
select is(app.set_notify_prefs_impl(:'miguel', '{"reminders": false}') ->> 'reminders', 'false', 'Miguel switches reminders off');
select is(app.set_notify_prefs_impl(:'ken', '{"friend_checkins": true}') ->> 'friend_checkins', 'true', 'Ken opts in to friend check-ins');

-- ------------------------------------------------------------------ friend check-ins (opt-in)
select app.check_in_impl(:'jason', '2026-12-01', 'clean', null, 'app', '2026-12-01 10:00Z');
select results_eq(
  format($$select user_id, title, link from visible where title like '✅%%' order by 1$$),
  format($$values (%L::uuid, '✅ Jason checked in', '/leaderboard')$$, :'ken'),
  'only Ken (opted in) hears that Jason checked in'
);

-- ------------------------------------------------------------------ daily reminder
select is(app.send_reminders('2026-12-01 10:00Z'), 0, 'no reminder before reminder time (19:30 local)');
select is(app.send_reminders('2026-12-01 11:31Z'), 1, 'at 21:01 only Ken is reminded');
select results_eq(
  $$select title, body, channel, link from visible where title = '🔒 Lock in.'$$,
  $$values ('🔒 Lock in.', 'Check in for today.', 'reminders', '/')$$,
  'the reminder uses the SPEC copy on the reminders channel'
);
select is(app.send_reminders('2026-12-01 13:00Z'), 0, 'a reminder is sent once per day');
select is((select count(*)::int from visible where user_id = :'jason' and title = '🔒 Lock in.'), 0, 'not if you already checked in');
select is((select count(*)::int from visible where user_id = :'miguel'), 0, 'not if reminders are off');
select is((select count(*)::int from public.notification_outbox where user_id = :'nodev'), 0, 'nothing is queued for a player with no phone');

-- Reminder time before check-in opens: wait for 17:00.
update public.profiles set reminder_time = '09:00' where id = :'ken';
select is(app.send_reminders('2026-12-02 01:00Z'), 0, 'a 9am reminder waits until check-in opens');

-- ------------------------------------------------------------------ final warning
select is(app.send_reminders('2026-12-02 12:00Z'), 2, 'at 21:30 Dec 2: Jason and Ken get today''s reminder');
select is(app.send_reminders('2026-12-02 12:31Z'), 1, 'at 22:01 Ken gets the final warning for Dec 1');
select results_eq(
  format($$select title, body from visible where user_id = %L and title like '⏰%%'$$, :'ken'),
  $$values ('⏰ 2 hours left', 'Check in for yesterday… or it counts as missed.')$$,
  'final warning copy'
);
select is((select count(*)::int from visible where user_id = :'jason' and title like '⏰%'), 0, 'no warning when yesterday is done');

-- ------------------------------------------------------------------ missed / frozen
select app.finalize_missed_days('2026-12-03 15:00Z');   -- Dec 4 00:30 local: Dec 1–2 finalised
select is((select count(*)::int from visible where user_id = :'ken' and title = '📉 Missed check-in'), 2, 'Ken hears about each missed day');
select is((select count(*)::int from visible where user_id = :'jason' and title = '🤡 Ken missed a check-in'), 2, 'the crew hears too');
select is((select count(*)::int from visible where user_id = :'ken' and title = '🧊 Jason used a freeze token'), 1, 'a freeze is announced to the crew');
select is((select count(*)::int from visible where title like '%Miguel missed%'), 0, 'frozen days are not announced as missed');
select is(
  (select link from visible where user_id = :'jason' and title = '🤡 Ken missed a check-in' limit 1),
  '/profile/' || :'ken', 'tapping opens Ken''s profile'
);

-- ------------------------------------------------------------------ honest slips are never announced as slips
select app.check_in_impl(:'miguel', '2026-12-04', 'relapse', null, 'app', '2026-12-04 08:00Z');
select results_eq(
  format($$select title from visible where user_id = %L and title like '%%Miguel%%' and title not like '🧊%%'$$, :'ken'),
  $$values ('✅ Miguel checked in')$$,
  'a slip reads as a plain check-in to the crew'
);

-- ------------------------------------------------------------------ rank ups & milestones
update public.user_stats set current_streak = 2, rank = 'Rookie', last_checkin_date = '2026-12-04' where user_id = :'jason';
update public.user_stats set current_streak = 3, rank = 'Grinder' where user_id = :'jason';
select is((select count(*)::int from visible where title = '⬆️ Jason reached Grinder'), 2, 'rank up goes to the crew');
select is((select count(*)::int from visible where title like '🔥 Jason hit%'), 0, 'rank up wins over the matching milestone');
update public.user_stats set current_streak = 89, rank = 'Final Boss' where user_id = :'jason';
update public.user_stats set current_streak = 90 where user_id = :'jason';
select is((select count(*)::int from visible where title = '🔥 Jason hit a 90-day streak'), 2, 'milestone goes to the crew');
update public.user_stats set current_streak = 89 where user_id = :'jason';
update public.user_stats set current_streak = 90 where user_id = :'jason';
select is((select count(*)::int from visible where title = '🔥 Jason hit a 90-day streak'), 2, 'undo → redo doesn''t announce it twice');

-- ------------------------------------------------------------------ vacations
select app.set_vacation_impl(:'ken', '2026-12-10', '2026-12-12', '2026-12-04 08:00Z');
select is((select title from visible where user_id = :'jason' and title like '🏝️%'), '🏝️ Ken is on vacation 10–12 Dec', 'vacation booking is announced');
select is(app.date_range_label('2026-12-28', '2027-01-03'), '28 Dec–3 Jan', 'ranges across months');

-- ------------------------------------------------------------------ client access
select tests.authenticate_as(:'miguel');
select is((public.get_notify_prefs() -> 'prefs'), '{"reminders": false, "group": true, "boxes": true, "friend_checkins": false}'::jsonb, 'get_notify_prefs fills in defaults');
select throws_ok($$select count(*) from app.notify_log$$, '42501', null, 'the sent-once log is server-only');
select tests.clear_authentication();

select * from finish();
rollback;

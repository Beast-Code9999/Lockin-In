-- =============================================================================
-- Lockin' In — leave_group (SPEC §1.8, §14.12, §18.1).
-- "Anyone may leave the group at any time, which stops all forfeits for them."
-- Leaving removes your data from the crew: check-ins (+ private notes), stats,
-- the events you caused and your vacations. Your profile stays, so you can
-- start or join another crew.
-- =============================================================================

-- A crew outlives its creator: deleting an account must never be blocked by
-- (or delete) a crew other people are still in.
alter table public.groups alter column created_by drop not null;
alter table public.groups drop constraint groups_created_by_fkey;
alter table public.groups
  add constraint groups_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

create or replace function app.leave_group_impl(p_user uuid, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.group_members;
  v_next uuid;
begin
  select * into v_member from public.group_members where user_id = p_user for update;
  if not found then perform app.fail('NOT_IN_GROUP'); end if;

  delete from public.checkins where user_id = p_user and group_id = v_member.group_id;  -- notes cascade
  delete from public.user_stats where user_id = p_user;
  delete from public.group_events where group_id = v_member.group_id and actor_id = p_user;
  delete from public.vacations where user_id = p_user;
  delete from public.group_members where user_id = p_user;

  -- Last one out: the crew goes with them.
  if not exists (select 1 from public.group_members where group_id = v_member.group_id) then
    delete from public.groups where id = v_member.group_id;
    return jsonb_build_object('group_id', v_member.group_id, 'group_deleted', true);
  end if;

  -- The owner left: hand the crew to whoever has been in it longest.
  if v_member.role = 'owner' then
    select user_id into v_next from public.group_members
     where group_id = v_member.group_id
     order by joined_at, user_id limit 1;
    update public.group_members set role = 'owner' where group_id = v_member.group_id and user_id = v_next;
    update public.groups set created_by = v_next where id = v_member.group_id;
  end if;

  insert into public.group_events (group_id, actor_id, type, payload, created_at)
  values (v_member.group_id, null, 'member_left',
          jsonb_build_object('text', (select display_name from public.profiles where id = p_user) || ' left the crew 👋'), p_now);

  return jsonb_build_object('group_id', v_member.group_id, 'group_deleted', false);
end $$;

create or replace function public.leave_group()
returns jsonb language sql security definer set search_path = ''
as $$ select app.leave_group_impl(app.require_uid(), now()) $$;

revoke all on function app.leave_group_impl(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.leave_group() from public, anon;
grant execute on function public.leave_group() to authenticated;

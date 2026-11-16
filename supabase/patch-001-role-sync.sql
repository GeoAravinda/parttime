-- Patch 001: apply staff roles set by the admin API.
-- Supabase Auth inserts the auth.users row first and writes app_metadata.role
-- in a later UPDATE, so the role must also be picked up on update.
-- (Already included in schema.sql — run this only on databases created before it.)

create or replace function public.handle_user_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role public.user_role;
begin
  if not (coalesce(new.raw_app_meta_data, '{}'::jsonb) ? 'role') then return new; end if;
  if tg_op = 'UPDATE' and (old.raw_app_meta_data->>'role') is not distinct from (new.raw_app_meta_data->>'role') then
    return new;
  end if;
  v_role := (new.raw_app_meta_data->>'role')::public.user_role;
  update public.users set role = v_role, status = 'active' where id = new.id;
  if v_role = 'student' then
    insert into public.student_profiles (user_id) values (new.id) on conflict do nothing;
    delete from public.teacher_profiles where user_id = new.id;
  else
    delete from public.student_profiles where user_id = new.id;
    if v_role = 'teacher' then
      insert into public.teacher_profiles (user_id) values (new.id) on conflict do nothing;
    else
      delete from public.teacher_profiles where user_id = new.id;
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.handle_user_role_change() from public, anon, authenticated;

drop trigger if exists on_auth_user_role_change on auth.users;
create trigger on_auth_user_role_change after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_role_change();

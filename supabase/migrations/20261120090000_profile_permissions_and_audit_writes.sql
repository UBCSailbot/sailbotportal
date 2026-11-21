create function public.guard_profile_permissions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and not public.is_admin()
     and (new.role is distinct from old.role
       or new.team_id is distinct from old.team_id
       or new.subteam_id is distinct from old.subteam_id) then
    raise exception 'Only administrators can change profile permissions.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_permissions() from public, anon, authenticated;

create trigger profiles_guard_permissions
  before update on public.profiles
  for each row execute function public.guard_profile_permissions();

-- Actual status changes are already recorded by the security-definer trigger.
drop policy "leads insert own team events" on public.application_events;
revoke insert on public.application_events from public, anon, authenticated;

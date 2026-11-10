alter table public.applications
  add column interview_notes_url text,
  add constraint applications_interview_notes_url_check check (
    interview_notes_url is null or (
      length(interview_notes_url) <= 2048
      and interview_notes_url ~ '^https://docs[.]google[.]com/document/d/[A-Za-z0-9_-]+/edit$'
    )
  );

create table public.application_interview_tags (
  application_id uuid not null references public.applications(id) on delete cascade,
  subteam_id uuid not null references public.subteams(id) on delete cascade,
  primary key (application_id, subteam_id)
);

create index application_interview_tags_subteam_idx
  on public.application_interview_tags (subteam_id, application_id);

alter table public.application_interview_tags enable row level security;
revoke all on public.application_interview_tags from public, anon, authenticated;
grant select, insert, delete on public.application_interview_tags to authenticated;
grant all on public.application_interview_tags to service_role;

create policy "leads read own team interview tags"
  on public.application_interview_tags for select to authenticated
  using (exists (
    select 1 from public.applications a
    join public.postings p on p.id = a.posting_id
    where a.id = application_interview_tags.application_id
      and (public.is_admin() or p.team_id = public.current_profile_team())
  ));

create policy "leads add own team interview tags"
  on public.application_interview_tags for insert to authenticated
  with check (exists (
    select 1 from public.applications a
    join public.postings p on p.id = a.posting_id
    join public.subteams s on s.team_id = p.team_id
    where a.id = application_interview_tags.application_id
      and s.id = application_interview_tags.subteam_id and s.active
      and (public.is_admin() or p.team_id = public.current_profile_team())
  ));

-- Removing a retained tag remains possible after its subteam becomes inactive.
create policy "leads remove own team interview tags"
  on public.application_interview_tags for delete to authenticated
  using (exists (
    select 1 from public.applications a
    join public.postings p on p.id = a.posting_id
    where a.id = application_interview_tags.application_id
      and (public.is_admin() or p.team_id = public.current_profile_team())
  ));

create function public.notify_application_interview_tags_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_id uuid;
begin
  if tg_op = 'INSERT' then
    application_id := new.application_id;
  else
    application_id := old.application_id;
  end if;

  -- Reuse the RLS-scoped applications realtime stream without changing status or its clock.
  update public.applications a set status = a.status where a.id = application_id;
  return null;
end;
$$;

revoke all on function public.notify_application_interview_tags_changed() from public, anon, authenticated;

create trigger application_interview_tags_changed
  after insert or delete on public.application_interview_tags
  for each row execute function public.notify_application_interview_tags_changed();

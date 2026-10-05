-- Garden sync schema for こもれび植物園
-- Apply locally: supabase db reset (when project is linked)
-- Do NOT apply to production without user approval

create table if not exists public.garden_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  revision bigint not null default 0,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.garden_snapshots enable row level security;

create policy "garden_select_own"
  on public.garden_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "garden_insert_own"
  on public.garden_snapshots
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "garden_update_own"
  on public.garden_snapshots
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "garden_delete_own"
  on public.garden_snapshots
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.garden_snapshots to authenticated;

-- Conditional upsert with revision CAS
create or replace function public.upsert_garden_snapshot(
  p_expected_revision bigint,
  p_new_revision bigint,
  p_state_json jsonb
)
returns public.garden_snapshots
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.garden_snapshots;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row from public.garden_snapshots where user_id = v_user_id;

  if v_row is null then
    insert into public.garden_snapshots (user_id, revision, state_json, updated_at)
    values (v_user_id, p_new_revision, p_state_json, now())
    returning * into v_row;
    return v_row;
  end if;

  if p_expected_revision is not null and v_row.revision <> p_expected_revision then
    raise exception 'revision_conflict: expected % but found %', p_expected_revision, v_row.revision;
  end if;

  if p_new_revision <= v_row.revision then
    raise exception 'revision_conflict: new revision % must be greater than %', p_new_revision, v_row.revision;
  end if;

  update public.garden_snapshots
  set revision = p_new_revision,
      state_json = p_state_json,
      updated_at = now()
  where user_id = v_user_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_garden_snapshot(bigint, bigint, jsonb) from public;
grant execute on function public.upsert_garden_snapshot(bigint, bigint, jsonb) to authenticated;

-- Private storage bucket for observation photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'observation-photos',
  'observation-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "photos_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "photos_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "photos_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "photos_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Account deletion helper (called from Edge Function with user JWT)
create or replace function public.delete_user_data()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.garden_snapshots where user_id = v_user_id;
end;
$$;

revoke all on function public.delete_user_data() from public;
grant execute on function public.delete_user_data() to authenticated;

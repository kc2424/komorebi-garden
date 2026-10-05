-- CAS revision (server-assigned), tombstone wipe, SECURITY DEFINER RPC writes

alter table public.garden_snapshots
  add column if not exists tombstone_revision bigint,
  add column if not exists wiped_at timestamptz;

revoke insert, update, delete on public.garden_snapshots from authenticated;
grant select on public.garden_snapshots to authenticated;

drop policy if exists "garden_insert_own" on public.garden_snapshots;
drop policy if exists "garden_update_own" on public.garden_snapshots;
drop policy if exists "garden_delete_own" on public.garden_snapshots;

drop function if exists public.upsert_garden_snapshot(bigint, bigint, jsonb);
drop function if exists public.upsert_garden_snapshot(bigint, jsonb);

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_id uuid not null,
  requested_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

revoke all on public.account_deletion_requests from public;
grant select on public.account_deletion_requests to authenticated;

drop policy if exists "deletion_select_own" on public.account_deletion_requests;
create policy "deletion_select_own"
  on public.account_deletion_requests for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.has_valid_auth_session()
returns boolean
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_claims jsonb;
begin
  if v_user_id is null then
    return false;
  end if;
  if not exists (select 1 from auth.users u where u.id = v_user_id) then
    return false;
  end if;
  v_claims := coalesce(auth.jwt(), '{}'::jsonb);
  if not (v_claims ? 'session_id') then
    return false;
  end if;
  begin
    v_session_id := (v_claims ->> 'session_id')::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1
    from auth.sessions s
    where s.id = v_session_id
      and s.user_id = v_user_id
      and (s.not_after is null or s.not_after > now())
  );
end;
$$;

revoke all on function public.has_valid_auth_session() from public;
grant execute on function public.has_valid_auth_session() to authenticated;

create or replace function public.verify_caller_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_session_id is null then
    return false;
  end if;
  if not exists (select 1 from auth.users u where u.id = v_user_id) then
    return false;
  end if;
  return exists (
    select 1
    from auth.sessions s
    where s.id = p_session_id
      and s.user_id = v_user_id
      and (s.not_after is null or s.not_after > now())
  );
end;
$$;

revoke all on function public.verify_caller_session(uuid) from public;
grant execute on function public.verify_caller_session(uuid) to authenticated;

create or replace function public.assert_sync_session_allowed()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not public.has_valid_auth_session() then
    raise exception 'invalid_session';
  end if;
  if exists (select 1 from public.account_deletion_requests where user_id = v_user_id) then
    raise exception 'account_deletion_in_progress';
  end if;
  return v_user_id;
end;
$$;

revoke all on function public.assert_sync_session_allowed() from public;

create or replace function public.upsert_garden_snapshot(
  p_expected_revision bigint,
  p_state_json jsonb
)
returns public.garden_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.garden_snapshots;
  v_new_revision bigint;
begin
  v_user_id := public.assert_sync_session_allowed();

  select * into v_row
  from public.garden_snapshots
  where user_id = v_user_id
  for update;

  if not found then
    if p_expected_revision is not null then
      raise exception 'revision_conflict: expected null for first insert but got %', p_expected_revision;
    end if;
    v_new_revision := 1;
    begin
      insert into public.garden_snapshots (user_id, revision, state_json, updated_at)
      values (v_user_id, v_new_revision, p_state_json, now())
      returning * into v_row;
      return v_row;
    exception
      when unique_violation then
        raise exception 'revision_conflict: concurrent first insert';
    end;
  end if;

  if p_expected_revision is null then
    raise exception 'revision_conflict: row exists at revision %', v_row.revision;
  end if;

  if v_row.revision <> p_expected_revision then
    raise exception 'revision_conflict: expected % but found %', p_expected_revision, v_row.revision;
  end if;

  if v_row.tombstone_revision is not null and p_expected_revision < v_row.tombstone_revision then
    raise exception 'revision_conflict: tombstone % blocks write at %', v_row.tombstone_revision, p_expected_revision;
  end if;

  v_new_revision := v_row.revision + 1;

  update public.garden_snapshots
  set revision = v_new_revision,
      state_json = p_state_json,
      updated_at = now()
  where user_id = v_user_id
    and revision = p_expected_revision;

  if not found then
    raise exception 'revision_conflict: concurrent update detected';
  end if;

  select * into v_row from public.garden_snapshots where user_id = v_user_id;
  return v_row;
end;
$$;

create or replace function public.wipe_garden_snapshot(p_expected_revision bigint)
returns public.garden_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.garden_snapshots;
  v_empty jsonb := '{"version":3,"soilTiles":[],"plants":[],"stashedPlants":[],"observations":[],"tulipUnlocked":false,"sync":{"revision":0,"lastSyncedRevision":null,"pendingChanges":false,"lastSyncAt":null,"lastError":null}}'::jsonb;
  v_new_revision bigint;
begin
  v_user_id := public.assert_sync_session_allowed();

  select * into v_row
  from public.garden_snapshots
  where user_id = v_user_id
  for update;

  if not found then
    if p_expected_revision is not null then
      raise exception 'revision_conflict: no row to wipe';
    end if;
    begin
      insert into public.garden_snapshots (user_id, revision, state_json, tombstone_revision, wiped_at, updated_at)
      values (v_user_id, 1, v_empty, 1, now(), now())
      returning * into v_row;
      return v_row;
    exception
      when unique_violation then
        raise exception 'revision_conflict: concurrent first insert';
    end;
  end if;

  if p_expected_revision is null or v_row.revision <> p_expected_revision then
    raise exception 'revision_conflict: expected % but found %', p_expected_revision, v_row.revision;
  end if;

  v_new_revision := v_row.revision + 1;

  update public.garden_snapshots
  set revision = v_new_revision,
      state_json = v_empty,
      tombstone_revision = v_new_revision,
      wiped_at = now(),
      updated_at = now()
  where user_id = v_user_id
    and revision = p_expected_revision;

  if not found then
    raise exception 'revision_conflict: concurrent wipe detected';
  end if;

  select * into v_row from public.garden_snapshots where user_id = v_user_id;
  return v_row;
end;
$$;

create or replace function public.delete_user_data()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_user_id) then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.account_deletion_requests where user_id = v_user_id) then
    raise exception 'deletion_not_requested';
  end if;
  delete from public.garden_snapshots where user_id = v_user_id;
end;
$$;

revoke all on function public.upsert_garden_snapshot(bigint, jsonb) from public;
grant execute on function public.upsert_garden_snapshot(bigint, jsonb) to authenticated;
revoke all on function public.wipe_garden_snapshot(bigint) from public;
grant execute on function public.wipe_garden_snapshot(bigint) to authenticated;
revoke all on function public.delete_user_data() from public;
grant execute on function public.delete_user_data() to authenticated;

-- Storage: valid session + no deletion marker
drop policy if exists "photos_select_own" on storage.objects;
drop policy if exists "photos_insert_own" on storage.objects;
drop policy if exists "photos_update_own" on storage.objects;
drop policy if exists "photos_delete_own" on storage.objects;

create policy "photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
    and public.has_valid_auth_session()
    and not exists (
      select 1 from public.account_deletion_requests r
      where r.user_id = (select auth.uid())
    )
  );

create policy "photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
    and public.has_valid_auth_session()
    and not exists (
      select 1 from public.account_deletion_requests r
      where r.user_id = (select auth.uid())
    )
  );

create policy "photos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
    and public.has_valid_auth_session()
    and not exists (
      select 1 from public.account_deletion_requests r
      where r.user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
    and public.has_valid_auth_session()
    and not exists (
      select 1 from public.account_deletion_requests r
      where r.user_id = (select auth.uid())
    )
  );

create policy "photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'observation-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
    and public.has_valid_auth_session()
    and not exists (
      select 1 from public.account_deletion_requests r
      where r.user_id = (select auth.uid())
    )
  );

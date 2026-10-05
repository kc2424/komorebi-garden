-- RLS / CAS / RPC verification (always ROLLBACK)
-- Usage: psql $DATABASE_URL -f supabase/verify/cas_rls_rollback.sql
-- Requires migrations 20260910120000 + 20260910140000 applied.

begin;

-- Fixture prep (superuser / RESET ROLE — not authenticated)
reset role;

insert into auth.users (
  instance_id, id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'user-a@test.local',
    now(), now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'user-b@test.local',
    now(), now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', now(), now())
on conflict (id) do nothing;

delete from public.garden_snapshots
where user_id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);
delete from public.account_deletion_requests
where user_id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);

create or replace function _verify_set_auth(p_uid uuid, p_session_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'session_id', p_session_id)::text,
    true
  );
  set local role authenticated;
end;
$$;

-- 1. authenticated cannot UPDATE garden_snapshots directly
select _verify_set_auth(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
do $$
begin
  update public.garden_snapshots
  set revision = 999
  where user_id = '11111111-1111-4111-8111-111111111111';
  raise exception 'FAIL: direct UPDATE should be denied';
exception
  when insufficient_privilege then
    raise notice 'OK: direct UPDATE denied for authenticated';
end $$;

-- 2. owner RPC first insert (expected_revision IS NULL)
reset role;
delete from public.garden_snapshots where user_id = '11111111-1111-4111-8111-111111111111';

select _verify_set_auth(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
do $$
declare v_row public.garden_snapshots;
begin
  v_row := public.upsert_garden_snapshot(null, '{"version":3,"observations":[]}'::jsonb);
  if v_row.user_id <> '11111111-1111-4111-8111-111111111111' then
    raise exception 'FAIL: row owner mismatch';
  end if;
  if v_row.revision <> 1 then
    raise exception 'FAIL: first revision should be 1';
  end if;
  raise notice 'OK: owner first insert revision=1';
end $$;

-- 3. user B isolated insert; user A cannot see B's row (RLS)
reset role;
delete from public.garden_snapshots where user_id = '22222222-2222-4222-8222-222222222222';

select _verify_set_auth(
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);
do $$
declare v_row public.garden_snapshots;
begin
  v_row := public.upsert_garden_snapshot(null, '{"version":3,"observations":[]}'::jsonb);
  if v_row.user_id <> '22222222-2222-4222-8222-222222222222' then
    raise exception 'FAIL: user B row owner mismatch';
  end if;
  raise notice 'OK: user B isolated first insert';
end $$;

select _verify_set_auth(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
do $$
declare v_count int;
begin
  select count(*) into v_count
  from public.garden_snapshots
  where user_id = '22222222-2222-4222-8222-222222222222';
  if v_count <> 0 then
    raise exception 'FAIL: user A must not see user B rows (got %)', v_count;
  end if;
  raise notice 'OK: RLS hides other user rows';
end $$;

-- 4. stale CAS rejected
select _verify_set_auth(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
do $$
declare v_row public.garden_snapshots;
begin
  v_row := public.upsert_garden_snapshot(1, '{"version":3,"observations":[{"id":"a"}]}'::jsonb);
  if v_row.revision <> 2 then raise exception 'FAIL: revision should be 2'; end if;
  begin
    perform public.upsert_garden_snapshot(1, '{"version":3}'::jsonb);
    raise exception 'FAIL: stale expected should conflict';
  exception when others then
    if sqlerrm not like '%revision_conflict%' then raise; end if;
    raise notice 'OK: stale CAS rejected';
  end;
end $$;

-- 5. tombstone wipe blocks stale push
select _verify_set_auth(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
do $$
declare v_row public.garden_snapshots;
begin
  v_row := public.wipe_garden_snapshot(2);
  if v_row.tombstone_revision is null then raise exception 'FAIL: tombstone missing'; end if;
  begin
    perform public.upsert_garden_snapshot(2, '{"version":3}'::jsonb);
    raise exception 'FAIL: post-wipe stale push should fail';
  exception when others then
    if sqlerrm not like '%revision_conflict%' then raise; end if;
    raise notice 'OK: tombstone blocks stale push';
  end;
end $$;

-- 6. deletion marker blocks RPC writes (marker inserted as superuser)
reset role;
insert into public.account_deletion_requests (user_id, session_id)
values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
)
on conflict (user_id) do update set session_id = excluded.session_id;

select _verify_set_auth(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
do $$
begin
  begin
    perform public.upsert_garden_snapshot(3, '{"version":3}'::jsonb);
    raise exception 'FAIL: deletion marker should block upsert';
  exception when others then
    if sqlerrm not like '%account_deletion_in_progress%' then raise; end if;
    raise notice 'OK: deletion marker blocks upsert';
  end;
end $$;

reset role;
delete from public.account_deletion_requests
where user_id = '11111111-1111-4111-8111-111111111111';

drop function if exists _verify_set_auth(uuid, uuid);

rollback;

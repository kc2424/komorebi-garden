-- Tighten grants: Supabase defaults may grant EXECUTE to anon per-function.
-- REVOKE FROM public alone does not remove anon/authenticated role grants.
-- Apply after komorebi_release_sync on ckdwboedxmdphhsyvnli.

-- 1. Revoke anon EXECUTE on all sync SECURITY DEFINER functions
revoke execute on function public.has_valid_auth_session() from anon;
revoke execute on function public.verify_caller_session(uuid) from anon;
revoke execute on function public.assert_sync_session_allowed() from anon;
revoke execute on function public.upsert_garden_snapshot(bigint, jsonb) from anon;
revoke execute on function public.wipe_garden_snapshot(bigint) from anon;
revoke execute on function public.delete_user_data() from anon;

-- 2. Revoke public (cascade baseline) then re-grant only what clients need
revoke all on function public.has_valid_auth_session() from public;
revoke all on function public.verify_caller_session(uuid) from public;
revoke all on function public.assert_sync_session_allowed() from public;
revoke all on function public.upsert_garden_snapshot(bigint, jsonb) from public;
revoke all on function public.wipe_garden_snapshot(bigint) from public;
revoke all on function public.delete_user_data() from public;

-- 3. Internal helper — not callable by API clients (used only inside other DEFINER RPCs)
revoke all on function public.assert_sync_session_allowed() from authenticated;

-- 4. User-facing functions — authenticated only
grant execute on function public.has_valid_auth_session() to authenticated;
grant execute on function public.verify_caller_session(uuid) to authenticated;
grant execute on function public.upsert_garden_snapshot(bigint, jsonb) to authenticated;
grant execute on function public.wipe_garden_snapshot(bigint) to authenticated;
grant execute on function public.delete_user_data() to authenticated;

-- 5. Tables — no anon access; minimal authenticated grants
revoke all on table public.garden_snapshots from anon;
revoke all on table public.account_deletion_requests from anon;

revoke insert, update, delete on table public.garden_snapshots from authenticated;
grant select on table public.garden_snapshots to authenticated;

revoke all on table public.account_deletion_requests from public;
grant select on table public.account_deletion_requests to authenticated;

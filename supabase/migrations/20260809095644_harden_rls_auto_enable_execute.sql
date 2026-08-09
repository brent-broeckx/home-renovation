-- The "Automatic RLS" feature installs public.rls_auto_enable(), a SECURITY
-- DEFINER function backing an event trigger. Because it lives in the exposed
-- `public` schema it is reachable as /rest/v1/rpc/rls_auto_enable by anyone.
-- The event trigger keeps working (it fires as the role running the DDL), so
-- revoking API-level EXECUTE is purely a hardening step.
--
-- Guarded with to_regprocedure so the migration is a no-op on projects that do
-- not have Automatic RLS enabled.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public;
    revoke all on function public.rls_auto_enable() from anon;
    revoke all on function public.rls_auto_enable() from authenticated;
  end if;
end
$$;

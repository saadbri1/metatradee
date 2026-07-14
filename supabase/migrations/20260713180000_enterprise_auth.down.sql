-- ============================================================================
-- Rollback for: 20260713180000_enterprise_auth.sql
-- Drops enterprise RBAC/SSO tables + the role-sync trigger/function. Safe to
-- re-run. Does NOT touch the 9.2 auth base. WARNING: removes org membership +
-- SSO connections (app_metadata roles set by the trigger are left as-is).
-- ============================================================================

drop trigger if exists org_member_role_sync on public.organization_members;
drop function if exists public.sync_member_role_to_metadata();

drop table if exists public.sso_connections cascade;
drop table if exists public.organization_members cascade;
drop table if exists public.organizations cascade;

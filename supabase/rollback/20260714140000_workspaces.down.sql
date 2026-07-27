-- ============================================================================
-- Rollback for: 20260714140000_workspaces.sql
-- Reverses ONLY the additive workspace objects. The locked 9.2 organization
-- tables/policies and every owner-scoped policy were never touched, so rolling
-- back restores the exact pre-11.0 state. Safe to re-run.
-- ============================================================================

drop table if exists public.workspace_shares cascade;
drop table if exists public.workspace_invitations cascade;

alter table public.organization_members drop constraint if exists org_members_workspace_role_chk;
alter table public.organization_members drop column if exists workspace_role;

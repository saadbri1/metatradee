-- ============================================================================
-- Rollback for: 20260714160000_enterprise_admin.sql
-- Reverses only the additive 11.1 objects. Suspension state is dropped with the
-- column (memberships revert to active); no personal data was ever touched.
-- Safe to re-run.
-- ============================================================================

drop table if exists public.api_tokens cascade;

alter table public.organization_members drop column if exists suspended_at;

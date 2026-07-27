-- ============================================================================
-- Rollback for: 20260712170000_calendar.sql
-- Drops the custom-sessions table. Safe to re-run.
-- ============================================================================

drop table if exists public.custom_sessions cascade;

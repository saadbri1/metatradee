-- ============================================================================
-- Rollback for: 20260713140000_reports.sql
-- Drops report tables + share functions in dependency-safe order. Safe to re-run.
-- WARNING: destroys saved reports, shares, schedules, export jobs, and audit.
-- ============================================================================

drop function if exists public.report_share_verify(text, text);
drop function if exists public.report_share_fetch(text);

drop table if exists public.report_events cascade;
drop table if exists public.export_jobs cascade;
drop table if exists public.report_schedules cascade;
drop table if exists public.report_shares cascade;
drop table if exists public.reports cascade;

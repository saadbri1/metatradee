-- Reverse of 20260726190000_integration_report_sessions.sql
drop trigger if exists set_integration_report_sessions_updated_at
  on public.integration_report_sessions;
drop index if exists public.integration_report_sessions_active_uniq;
drop index if exists public.integration_report_sessions_lookup_idx;
drop table if exists public.integration_report_sessions;

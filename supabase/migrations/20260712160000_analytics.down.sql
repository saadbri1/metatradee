-- ============================================================================
-- Rollback for: 20260712160000_analytics.sql
-- Drops the widget-layouts table and the daily-stats view. Safe to re-run.
-- ============================================================================

drop table if exists public.dashboard_layouts cascade;
drop view if exists public.trade_daily_stats;

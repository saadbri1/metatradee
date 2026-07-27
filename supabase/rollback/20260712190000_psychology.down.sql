-- ============================================================================
-- Rollback for: 20260712190000_psychology.sql
-- Drops psychology/goal/habit tables in dependency-safe order. Safe to re-run.
-- WARNING: destroys sensitive personal data (psychology entries, habits, goals).
-- ============================================================================

drop table if exists public.discipline_snapshots cascade;
drop table if exists public.psychology_entries cascade;
drop table if exists public.habit_logs cascade;
drop table if exists public.habits cascade;
drop table if exists public.goals cascade;

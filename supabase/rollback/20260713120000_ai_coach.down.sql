-- ============================================================================
-- Rollback for: 20260713120000_ai_coach.sql
-- Drops AI coach tables in dependency-safe order. Safe to re-run.
-- WARNING: destroys generated reviews, feedback, and the AI audit trail.
-- ============================================================================

drop table if exists public.ai_feedback cascade;
drop table if exists public.ai_requests cascade;
drop table if exists public.ai_reviews cascade;

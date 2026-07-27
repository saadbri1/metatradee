-- ============================================================================
-- Rollback for: 20260712120000_auth_foundation.sql
--
-- Reverses the migration in dependency-safe order: triggers on auth.users first,
-- then functions, then the supplementary tables (which also drops their own
-- triggers/policies). The `citext` extension is intentionally LEFT in place —
-- other objects may depend on it and dropping shared extensions is unsafe.
--
-- Safe to run more than once (all statements use IF EXISTS).
-- WARNING: dropping the tables permanently deletes profile/preference/settings
-- and audit-log data. Take a backup before running in production.
-- ============================================================================

-- Triggers on auth.users must go before their functions.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;

drop function if exists public.handle_new_user();
drop function if exists public.handle_user_updated();
drop function if exists public.log_audit_event(text, jsonb, text, text);

-- Tables (cascade removes their policies, triggers, indexes, constraints).
drop table if exists public.audit_logs cascade;
drop table if exists public.user_settings cascade;
drop table if exists public.user_preferences cascade;
drop table if exists public.profiles cascade;

-- Shared helper last (nothing above depends on it after the tables are gone).
drop function if exists public.set_updated_at();

-- Intentionally NOT dropped: extension "citext".

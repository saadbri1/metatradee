-- ============================================================================
-- Rollback for: 20260714100000_database_core_gaps.sql
--
-- Reverses ONLY what that migration added. It never touches pre-existing 9.2–9.14
-- objects. Safe to re-run.
--
-- Order matters: drop the policies that depend on is_admin() BEFORE the function.
-- ============================================================================

-- 4. notifications (drops its policies/indexes/trigger with the table).
drop table if exists public.notifications cascade;

-- 3. trading_accounts additions. The legacy free-text `broker` column was never
--    touched, so dropping broker_id loses no pre-existing data.
drop index if exists public.trading_accounts_user_active_idx;
drop index if exists public.trading_accounts_broker_id_idx;
alter table public.trading_accounts drop column if exists broker_id;

-- 2. brokers admin-write policies (restores the prior state: auth-read only,
--    no client write).
drop policy if exists "brokers_delete_admin" on public.brokers;
drop policy if exists "brokers_update_admin" on public.brokers;
drop policy if exists "brokers_insert_admin" on public.brokers;

-- 1. is_admin() — dropped last, after its dependent policies are gone.
drop function if exists public.is_admin();

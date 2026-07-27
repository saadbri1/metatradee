-- ============================================================================
-- Rollback for: 20260712150000_journal_core.sql
--
-- Drops the journal tables in dependency-safe order (join tables first). The
-- pgcrypto extension is left in place. WARNING: destroys all trade data.
-- Safe to re-run (IF EXISTS).
-- ============================================================================

drop table if exists public.trade_collection_items cascade;
drop table if exists public.trade_collections cascade;
drop table if exists public.saved_filters cascade;
drop table if exists public.trade_tags cascade;
drop table if exists public.trades cascade;
drop table if exists public.brokers cascade;

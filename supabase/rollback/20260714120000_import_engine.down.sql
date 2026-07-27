-- ============================================================================
-- Rollback for: 20260714120000_import_engine.sql
-- Reverses ONLY what that migration added, in dependency-safe order. Trades
-- created by imports are NOT deleted (they belong to the user; import_id is
-- simply detached by the FK drop + column stays from the journal migration).
-- Safe to re-run.
-- ============================================================================

drop index if exists public.trades_import_id_idx;
alter table public.trades drop constraint if exists trades_import_id_fkey;

drop table if exists public.mapping_templates cascade;
drop table if exists public.import_rows cascade;
drop table if exists public.imports cascade;

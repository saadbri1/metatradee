-- ============================================================================
-- Rollback for: 20260712151000_journal_storage.sql
-- Drops the storage.objects policies and removes the buckets (must be empty).
-- Safe to re-run (IF EXISTS).
-- ============================================================================

do $$
declare
  b text;
begin
  foreach b in array array['trade-screenshots','documents'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_select_own');
    execute format('drop policy if exists %I on storage.objects', b || '_insert_own');
    execute format('drop policy if exists %I on storage.objects', b || '_update_own');
    execute format('drop policy if exists %I on storage.objects', b || '_delete_own');
  end loop;
end;
$$;

-- Requires the buckets to be empty:
-- delete from storage.buckets where id in ('trade-screenshots','documents');

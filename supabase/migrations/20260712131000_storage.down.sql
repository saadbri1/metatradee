-- ============================================================================
-- Rollback for: 20260712131000_storage.sql
--
-- Drops the storage.objects policies and removes the buckets. Bucket deletion
-- fails if objects still exist, so empty them first in a real environment.
-- Safe to re-run (IF EXISTS).
-- ============================================================================

drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

drop policy if exists "attachments_select_own" on storage.objects;
drop policy if exists "attachments_insert_own" on storage.objects;
drop policy if exists "attachments_update_own" on storage.objects;
drop policy if exists "attachments_delete_own" on storage.objects;

-- Requires the buckets to be empty. Uncomment to remove them on rollback:
-- delete from storage.buckets where id in ('avatars', 'attachments');

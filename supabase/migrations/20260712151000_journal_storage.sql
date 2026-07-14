-- ============================================================================
-- Migration: journal_storage (Phase 9.6)
--
-- Private buckets for trade attachments, owner-scoped by first path segment
-- (`{user_id}/...`), mirroring the 9.3 avatars/attachments policy pattern.
--   trade-screenshots  images/charts, 10 MB.
--   documents          statements/PDFs, 20 MB.
-- Idempotent; rollback in the paired *.down.sql.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-screenshots',
  'trade-screenshots',
  false,
  10485760, -- 10 MB
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB
  array['application/pdf','text/csv','text/plain','image/png','image/jpeg']
)
on conflict (id) do nothing;

do $$
declare
  b text;
begin
  foreach b in array array['trade-screenshots','documents'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_select_own');
    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_select_own', b);

    execute format('drop policy if exists %I on storage.objects', b || '_insert_own');
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_insert_own', b);

    execute format('drop policy if exists %I on storage.objects', b || '_update_own');
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_update_own', b, b);

    execute format('drop policy if exists %I on storage.objects', b || '_delete_own');
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_delete_own', b);
  end loop;
end;
$$;

# Storage Guide

## Buckets

All buckets are **private** (`public = false`). Bytes are served only via short-lived **signed
URLs**; the row metadata lives in the `attachments` table (`bucket` + `path`).

| Bucket              | Purpose                   | Created in                           |
| ------------------- | ------------------------- | ------------------------------------ |
| `avatars`           | Profile images            | `20260712131000_storage.sql`         |
| `attachments`       | General user attachments  | `20260712131000_storage.sql`         |
| `trade-screenshots` | Trade chart screenshots   | `20260712151000_journal_storage.sql` |
| `documents`         | Statements, exports, docs | `20260712151000_journal_storage.sql` |

> **`future-attachments` was NOT created.** The existing `attachments` bucket already serves that
> purpose; adding a second general bucket would be duplication. Flagged in the 9.3 gap report — say
> the word if you want it split out.

## Path convention (the security boundary)

```
<bucket>/<user_id>/<resource_id>/<filename>
```

The **first path segment must be the owner's `auth.uid()`**. Storage policies are path-scoped on
exactly that:

```sql
using ( (storage.foldername(name))[1] = auth.uid()::text )
```

This means a user physically cannot read or write outside their own folder, even with a guessed
object name. Never construct a path that puts anything other than the user id first.

## Rules

- **Private by default.** Never flip a bucket to `public`.
- **Signed URLs only**, short expiry. Never embed a signed URL in a shared/public report payload —
  it would outlive the share's own access control.
- **Validate server-side.** MIME type and size are enforced by the bucket config _and_
  re-validated in the server action — the bucket is the backstop, not the only check.
- **Metadata in Postgres, bytes in Storage.** Deleting an `attachments` row does not delete the
  object; clean up both.

## Pending-live

Storage policy enforcement (user B cannot fetch user A's object path) requires a live Supabase
project with two JWTs — it cannot be asserted statically.

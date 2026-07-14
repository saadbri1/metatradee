# Supabase — Database & Auth

Migrations for MetaTradee. Auth (9.2) adds **supplementary** identity data only;
Database Core (9.3) adds the per-user domain tables + storage. Identity itself
lives in Supabase's built-in `auth.users` and is never duplicated here.

## Migrations

| File                                                    | Purpose                                                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrations/20260712120000_auth_foundation.sql`         | 9.2 — `profiles`, `user_preferences`, `user_settings`, `audit_logs` + RLS, triggers, security-definer funcs.                                  |
| `migrations/20260712130000_database_core.sql`           | 9.3 — `strategies`, `tags`, `attachments`, `trading_accounts` + RLS; `ensure_workspace_defaults`; trigger ext.                                |
| `migrations/20260712131000_storage.sql`                 | 9.3 — `avatars` + `attachments` storage buckets + owner-scoped `storage.objects` policies.                                                    |
| `migrations/20260712140000_user_profile_onboarding.sql` | 9.4 — extends `profiles` (bio/country/tz/language/onboarding) + `user_preferences` (formatting/JSON bags); new `trading_profiles` (1:1, RLS). |
| `*.down.sql`                                            | Full, dependency-safe rollback paired with each migration above.                                                                              |

Every table has **RLS enabled** with owner-scoped, least-privilege policies.
`audit_logs` has **no client write policy** — the only write path is the
security-definer `public.log_audit_event(...)`, which always stamps `auth.uid()`
and never trusts a client-supplied user id.

## Database Core (9.3)

- **Tables** (`strategies`, `tags`, `attachments`, `trading_accounts`): UUID PK,
  `user_id → auth.users ON DELETE CASCADE`, `created_at/updated_at` via the
  shared `set_updated_at` trigger, `user_id` index, soft-delete (`deleted_at`)
  where meaningful, and owner-only RLS (select/insert/update/delete own).
- **Enumerations** use `text` + `CHECK` (mirrored in `src/lib/db/enums.ts`).
- **Provisioning:** `ensure_workspace_defaults(uuid)` (security definer) seeds
  starter tags + a default strategy. It keys off `auth.uid()` (falling back to
  the arg only when session-less, e.g. the signup trigger / service_role), so a
  user can only ever provision **their own** workspace. Idempotent via unique
  indexes + `ON CONFLICT DO NOTHING`; the 9.2 `handle_new_user` trigger calls it,
  and the app calls it on first login (`src/lib/db/provisioning.ts`).

## Storage (9.3)

- Private buckets **`avatars`** (5 MB, image mime allowlist) and **`attachments`**
  (10 MB). `storage.objects` policies restrict all access to objects whose FIRST
  path segment equals `auth.uid()` — i.e. the **path convention is
  `{user_id}/...`** (see `src/lib/db/paths.ts`, which never trusts client names).
- Avatar constraints are re-validated in app code (`src/lib/db/avatar.ts`) client
  AND server side; avatar metadata is tracked in `attachments` (replace-old-on-new
  via the `(bucket, path)` unique constraint).

## Applying

With the Supabase CLI linked to your project:

```bash
supabase db push            # apply pending migrations
# rollback (manual): run the paired *.down.sql against the database
supabase db execute --file supabase/migrations/20260712120000_auth_foundation.down.sql
```

The up migration is idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE` /
`DROP ... IF EXISTS`) and safe to re-run.

## Supabase dashboard settings this phase depends on

These are **project settings** (not code) — configure them in the dashboard or
`config.toml` when a real project exists:

- **Auth → Email → Confirm email: ON** (verification required before sensitive actions).
- **Auth → URL Configuration → Site URL**: your app origin.
- **Redirect allowlist**: `${APP_URL}/auth/callback`, `${APP_URL}/auth/confirm`.
- **Email templates**: point the _Confirm signup_ and _Reset password_ links at
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=...`
  (token-hash verification flow used by `src/app/auth/confirm/route.ts`).

## Generating types (optional, later)

```bash
supabase gen types typescript --linked > src/types/database.ts
```

> Not committed yet — the auth code is written against narrow local types so it
> compiles without a live project. Wire generated types in when the project exists.

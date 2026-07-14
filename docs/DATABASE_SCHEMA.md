# Database Schema

44 tables across 15 migrations. Every table has RLS (see `RLS_GUIDE.md`). Every user-owned table
links to `auth.users(id)` by FK — **`auth.users` is never duplicated**.

## Conventions

- **PK**: `uuid primary key default gen_random_uuid()` (append-only logs use `bigint identity`).
- **Timestamps**: `created_at` / `updated_at`, with the shared `public.set_updated_at()` trigger
  (defined once in `20260712120000_auth_foundation.sql` — never redefine it).
- **Soft delete**: `deleted_at timestamptz` on user content. **Not** on reference tables
  (`brokers`) or append-only logs. `notifications` uses `dismissed_at` (dismiss ≠ destroy).
- **FK intent**: `on delete cascade` for user-owned rows (deleting a user erases their data);
  `on delete set null` for reference links (removing a broker must never delete a user's account).

## Core (Phase 9.3)

| Table              | Purpose                                         | Ownership         | Notes                                                    |
| ------------------ | ----------------------------------------------- | ----------------- | -------------------------------------------------------- |
| `brokers`          | Broker/platform reference                       | _global_          | auth-read; **admin-write** via `is_admin()`              |
| `trading_accounts` | Live/demo/prop accounts                         | `user_id` cascade | soft-delete; optional `broker_id` → `brokers` (set null) |
| `strategies`       | Strategy definitions                            | `user_id` cascade | soft-delete                                              |
| `tags`             | Setup/mistake/emotion taxonomy                  | `user_id` cascade | unique `(user_id, category, lower(name))`                |
| `custom_sessions`  | **This is `trade_sessions`** — session metadata | `user_id` cascade | metadata only; holds **no trade rows**                   |
| `audit_logs`       | **This is `activity_logs`** — append-only trail | `user_id`         | owner-read; **no client insert** (`log_audit_event()`)   |
| `attachments`      | File metadata (`bucket` + `path`)               | `user_id` cascade | metadata only; bytes live in Storage                     |
| `notifications`    | In-app notifications                            | `user_id` cascade | owner read + mark-read/dismiss; **no client insert**     |

> Naming note: `trade_sessions` and `activity_logs` from the spec were already implemented under
> the names `custom_sessions` and `audit_logs`. They were **not** duplicated.

## Identity (9.2)

`profiles`, `user_preferences`, `user_settings`, `audit_logs`, `organizations`,
`organization_members`, `sso_connections`. Roles sync to `app_metadata` via trigger.

## Feature tables

`trades` + `trade_tags` (journal) · `strategy_versions`, `trade_strategy_adherence` (playbook) ·
`goals`, `habits`, `habit_logs`, `psychology_entries` (psychology — **private by design**) ·
`ai_reviews`, `ai_feedback`, `ai_requests` (AI coach) · `reports`, `report_shares`,
`report_schedules`, `export_jobs` (reports) · `billing_*` (provider mirror — **no card data**).

# Database Policies

Every policy's `USING` / `WITH CHECK` intent. See `RLS_GUIDE.md` for the four shapes.

## Owner-scoped (the default)

Applies to `trades`, `trading_accounts`, `strategies`, `tags`, `custom_sessions`, `attachments`,
`goals`, `habits`, `psychology_entries`, `reports`, `ai_reviews`, and every other user table.

```sql
for all
  using      (auth.uid() = user_id)   -- rows you may read/modify
  with check (auth.uid() = user_id)   -- rows you may write (blocks re-assigning to another user)
```

## `brokers` — reference data

| Policy                 | Op     | Intent                                               |
| ---------------------- | ------ | ---------------------------------------------------- |
| `brokers_select_all`   | select | Any authenticated user may read the broker list.     |
| `brokers_insert_admin` | insert | `with check (is_admin())` — only admins add brokers. |
| `brokers_update_admin` | update | `using` + `with check (is_admin())`.                 |
| `brokers_delete_admin` | delete | `using (is_admin())`.                                |

> Before 9.3, `brokers` had **no write policy at all** (seeded only by migration). The admin-write
> policies close that gap explicitly through the `is_admin()` seam.

## `notifications` — owner read + mark-read, **no client insert**

| Policy                     | Op         | Intent                                                                                                                                           |
| -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `notifications_select_own` | select     | `using (auth.uid() = user_id)`                                                                                                                   |
| `notifications_update_own` | update     | mark read/dismissed. `WITH CHECK` re-asserts ownership so a row can never be re-assigned.                                                        |
| `notifications_delete_own` | delete     | owner may remove their own.                                                                                                                      |
| _(none)_                   | **insert** | **Deliberately absent** — a client must not be able to fabricate a notification. Creation is server-side (service role / definer function) only. |

## Append-only trails

`audit_logs`, `ai_requests`, `report_events` — owner `select` only. Writes go through a
`security definer` function (`log_audit_event()`) or the service role. No update/delete policy:
the trail is immutable.

## Deny-all to clients

`billing_events` — RLS enabled, **zero policies**. Postgres denies everything by default, so only
the service-role webhook can touch it. Intentional; asserted in the invariant test's allowlist.

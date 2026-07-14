# RLS Guide

Row Level Security is the **primary** authorization boundary in MetaTradee. Server guards
(`.eq('user_id', userId)`) are belt-and-suspenders on top — never a replacement.

## The contract

**Every table in `public` has RLS enabled.** This is enforced in CI by
`tests/unit/db/rls-invariants.test.ts`, which parses every migration and fails the build if a
new table lacks RLS or a policy. Do not add a table without both.

## The four policy shapes

| Shape                 | Used for                                              | Policy                                                                                              |
| --------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Owner** (default)   | All user data (`trades`, `goals`, `notifications`, …) | `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`                            |
| **Reference**         | `brokers`                                             | `for select to authenticated using (true)` + admin-only write via `is_admin()`                      |
| **Append-only**       | `audit_logs`, `ai_requests`, `report_events`          | owner `select`; **no client insert** — written by a `security definer` function or the service role |
| **Service-role-only** | `billing_events`                                      | RLS on, **zero policies** → deny-all to clients. Only the webhook (service role) writes.            |

### Always write `WITH CHECK`, not just `USING`

`USING` decides which **existing** rows you may see/modify. `WITH CHECK` decides which rows you
may **write**. Omitting `WITH CHECK` on an `UPDATE` policy lets a user re-assign their row to
another `user_id`. Both clauses on every owner policy.

## `is_admin()` — the single RBAC seam

```sql
public.is_admin()  -- true when app_metadata.role ∈ (admin, owner); fail-closed otherwise
```

Roles live in `auth.users.raw_app_meta_data.role` (tamper-proof — the client cannot set it;
the `organization_members` trigger from 9.2 syncs it). **Reuse `is_admin()` for every
admin-scoped policy. Never introduce a second roles system.**

## Soft delete

Owner policies do **not** filter `deleted_at` — that is a query concern, not a security one.
Always add `.is('deleted_at', null)` in the repository layer.

## Verifying isolation

The invariant suite proves the policies _exist and are shaped correctly_. Proving user B cannot
read user A's rows requires **two real JWTs against a live database** — see
`MIGRATION_GUIDE.md` § Verifying against a live project. That check is currently **pending-live**.

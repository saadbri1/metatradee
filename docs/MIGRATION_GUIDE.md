# Migration Guide

## Rules

1. **Additive only.** Never drop, recreate, or rewrite an existing table/policy/trigger. To change
   something, write a **new** migration that extends it.
2. **Idempotent.** `create table if not exists`, `add column if not exists`,
   `create index if not exists`, `drop policy if exists` before `create policy`,
   `create or replace function`. A migration must survive being re-run.
3. **Reversible.** Every `NNN_name.sql` has a paired `NNN_name.down.sql` that reverses **only**
   what it added. Both are enforced in CI by `tests/unit/db/rls-invariants.test.ts`.
4. **RLS + policy on every new table.** No exceptions (a deliberate deny-all table must be added to
   the `SERVICE_ROLE_ONLY` allowlist in the invariant test, with a comment explaining why).
5. **Reuse, don't redefine.** `set_updated_at()`, `log_audit_event()`, `is_admin()` are defined
   once. Never create a second copy.

## Rollback order

Drop in dependency order. Policies that call a function must be dropped **before** the function:

```sql
drop table if exists public.notifications cascade;   -- takes its policies with it
drop policy if exists "brokers_insert_admin" on public.brokers;
drop function if exists public.is_admin();           -- last
```

## Naming

`YYYYMMDDHHMMSS_snake_case_purpose.sql`. Timestamps must increase monotonically.

## Verifying against a live project (pending-live)

The static invariant suite runs in CI. **Cross-user isolation cannot be proven statically** — it
needs a live database and two real JWTs:

```sql
-- as user A
insert into trades (...) values (...);
-- as user B
select * from trades;            -- must return 0 rows belonging to A
update trades set notes = 'x';   -- must affect 0 rows
```

Run `supabase db reset` (applies every migration in order) then the up+rollback pair for the newest
migration, then the isolation probe above, per new table.

-- ============================================================================
-- Migration: database_core_gaps (Phase 9.3 — audit-first gap-fill)
--
-- ADDITIVE ONLY. Closes the four gaps found by auditing migrations 9.2–9.14.
-- Nothing existing is dropped, recreated, or redesigned.
--
--   1. is_admin()                  — MISSING. The RBAC seam other policies are
--                                    supposed to reuse did not exist. Reads the
--                                    9.2 role (app_metadata, set by the
--                                    organization_members trigger). FAIL-CLOSED.
--   2. brokers admin-write policy  — brokers had auth-read but NO write policy
--                                    at all. Reference data: authenticated read,
--                                    admin-only write (service role bypasses RLS).
--   3. trading_accounts.broker_id  — optional FK to the brokers reference table
--                                    (the existing free-text `broker` column is
--                                    KEPT; this is purely additive).
--   4. notifications               — MISSING. Owner-scoped; owner may read and
--                                    mark-read; clients may NOT insert (created
--                                    server-side / by the definer function).
--
-- NOT created (deliberate, see report): `trade_sessions` (exists as
-- `custom_sessions`), `activity_logs` (exists as `audit_logs`), a
-- `future-attachments` bucket (the existing `attachments` bucket serves it).
--
-- Idempotent (guarded) + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. is_admin() — the single RBAC seam for admin-scoped policies.
--
-- Roles live in auth.users.raw_app_meta_data.role (tamper-proof; only the
-- service role / the organization_members sync trigger writes it — see 9.2
-- enterprise_auth). STABLE so the planner can cache it per statement.
--
-- FAIL CLOSED: no JWT, no role, or an unrecognized role → false.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select u.raw_app_meta_data ->> 'role' in ('admin', 'owner')
      from auth.users u
      where u.id = auth.uid()
    ),
    false
  );
$$;

comment on function public.is_admin() is
  'RBAC seam (9.2): true when the current user''s app_metadata role is admin/owner. Fail-closed. Reuse for all admin-scoped policies — do not add a second roles system.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. brokers — reference table. Previously: authenticated SELECT, and NO write
--    policy (so nobody but the service role could write). Add explicit
--    admin-only write via the is_admin() seam.
--    USING     → which existing rows an admin may update/delete.
--    WITH CHECK→ which new/updated rows an admin may write.
-- ---------------------------------------------------------------------------
drop policy if exists "brokers_insert_admin" on public.brokers;
create policy "brokers_insert_admin" on public.brokers
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "brokers_update_admin" on public.brokers;
create policy "brokers_update_admin" on public.brokers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "brokers_delete_admin" on public.brokers;
create policy "brokers_delete_admin" on public.brokers
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. trading_accounts.broker_id — optional link to the brokers reference table.
--    ON DELETE SET NULL: brokers are reference data; removing one must never
--    cascade-delete a user's account. The legacy free-text `broker` column is
--    intentionally left in place (non-destructive; backfill is a later concern).
-- ---------------------------------------------------------------------------
alter table public.trading_accounts
  add column if not exists broker_id uuid references public.brokers (id) on delete set null;

create index if not exists trading_accounts_broker_id_idx
  on public.trading_accounts (broker_id);

-- Partial index for the hot path: a user's live (non-deleted) accounts.
create index if not exists trading_accounts_user_active_idx
  on public.trading_accounts (user_id)
  where deleted_at is null;

comment on column public.trading_accounts.broker_id is
  'Optional FK to the brokers reference table. Additive: the legacy free-text `broker` column is retained.';

-- ---------------------------------------------------------------------------
-- 4. notifications — owner-scoped, in-app notifications.
--    Append-only from the CLIENT's perspective: the owner may read and mark
--    read/dismissed, but may NOT insert (no insert policy) — notifications are
--    created server-side (service role) or via a definer function, so a user can
--    never fabricate one. Not a reference table, so it carries soft-delete via
--    `dismissed_at` rather than `deleted_at` (dismiss ≠ destroy).
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null
               check (type in ('system', 'trade', 'report', 'billing', 'ai', 'reminder')),
  title        text not null,
  body         text,
  -- Optional deep-link into the app (e.g. /journal/<id>). Never an external URL.
  link         text,
  metadata     jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  dismissed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint notifications_title_len check (char_length(title) between 1 and 160)
);

comment on table public.notifications is
  'Owner-scoped in-app notifications. Client may read + mark-read/dismiss only; inserts are server-side (no insert policy).';

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Partial index for the unread badge count (the hottest query).
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null and dismissed_at is null;

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;

-- Owner may read only their own notifications.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);

-- Owner may mark their own read/dismissed. WITH CHECK re-asserts ownership so a
-- row can never be re-assigned to another user via UPDATE.
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owner may delete their own. NO INSERT POLICY → clients cannot fabricate
-- notifications; creation is server-side only.
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (auth.uid() = user_id);

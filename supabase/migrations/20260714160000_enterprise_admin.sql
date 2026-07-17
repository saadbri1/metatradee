-- ============================================================================
-- Migration: enterprise_admin (Phase 11.1 — Enterprise Administration)
--
-- ADDITIVE ONLY. Extends the held 11.0 workspace layer (apply together after
-- the staging isolation probes). No existing table's policies are touched.
--
--   • organization_members.suspended_at — suspension NARROWS access (every
--     membership lookup treats suspended as no-membership, fail closed). Never
--     widens anything; data is never deleted.
--   • api_tokens — a NEW CREDENTIAL CLASS: only SHA-256 hashes at rest
--     (plaintext shown once, never stored/logged); org-scoped; scopes are 11.0
--     permission grants; authority is re-resolved against the CREATOR'S CURRENT
--     role on every use (no RBAC bypass — enforced in code, mirrored here by
--     the created_by FK). Admin/owner manage via membership+role policy.
--
-- Idempotent + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Suspension (additive; null = active). Fail-closed consumers treat non-null
-- as no-membership immediately.
-- ---------------------------------------------------------------------------
alter table public.organization_members
  add column if not exists suspended_at timestamptz;

-- ---------------------------------------------------------------------------
-- api_tokens — hash-only at rest; prefix is the public identifier.
-- ---------------------------------------------------------------------------
create table if not exists public.api_tokens (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  created_by   uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  prefix       text not null,
  token_hash   text not null unique,
  scopes       text[] not null default '{}',
  expires_at   timestamptz,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint api_tokens_name_len check (char_length(name) between 1 and 60),
  constraint api_tokens_scopes_nonempty check (array_length(scopes, 1) >= 1)
);
create index if not exists api_tokens_org_idx on public.api_tokens (org_id);
create index if not exists api_tokens_hash_idx on public.api_tokens (token_hash);

drop trigger if exists set_api_tokens_updated_at on public.api_tokens;
create trigger set_api_tokens_updated_at before update on public.api_tokens
  for each row execute function public.set_updated_at();

alter table public.api_tokens enable row level security;

-- Org admins/owners manage tokens — MEMBERSHIP + ROLE + NOT-SUSPENDED check,
-- never a bare org match. The hash column is exposed only to these rows'
-- owners; plaintext never exists server-side after creation.
drop policy if exists "api_tokens_manage_admin" on public.api_tokens;
create policy "api_tokens_manage_admin" on public.api_tokens
  for all using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = api_tokens.org_id
        and m.user_id = auth.uid()
        and m.role in ('admin','owner')
        and m.suspended_at is null
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = api_tokens.org_id
        and m.user_id = auth.uid()
        and m.role in ('admin','owner')
        and m.suspended_at is null
    )
  );

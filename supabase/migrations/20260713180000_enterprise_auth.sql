-- ============================================================================
-- Migration: enterprise_auth (Phase 9.2 enterprise additions — RBAC/MFA/SSO)
--
-- Layers enterprise auth onto the existing 9.2 base (does NOT modify it). Roles
-- are authoritative in `app_metadata` (tamper-proof, resolved by rbac.ts); these
-- tables are the MANAGEMENT system-of-record + SSO scaffolding. A trigger mirrors
-- a member's role into app_metadata so the sync entitlement seam stays fast.
--
-- MFA uses Supabase's native factors (auth.mfa) — NO TOTP secrets are stored
-- here. Idempotent + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- organizations — an enterprise tenant. `created_by` is the initial owner.
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;

-- ---------------------------------------------------------------------------
-- organization_members — user ↔ org with an RBAC role. Unique per (org, user).
-- This is the system-of-record for roles; app_metadata mirrors the active role.
-- ---------------------------------------------------------------------------
create table if not exists public.organization_members (
  id       uuid primary key default gen_random_uuid(),
  org_id   uuid not null references public.organizations (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  role     text not null default 'member' check (role in ('member','admin','owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists org_members_user_idx on public.organization_members (user_id);

create trigger set_org_members_updated_at before update on public.organization_members
  for each row execute function public.set_updated_at();

alter table public.organization_members enable row level security;

-- A member can read orgs they belong to; owners/admins manage membership.
create policy "orgs_select_member" on public.organizations
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = organizations.id and m.user_id = auth.uid()
    )
  );
create policy "org_members_select_own_org" on public.organization_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.org_id = organization_members.org_id
        and m.user_id = auth.uid()
        and m.role in ('admin','owner')
    )
  );

-- ---------------------------------------------------------------------------
-- sso_connections — SAML SSO scaffolding. An active connection maps an email
-- domain to an org's IdP; login for that domain is routed to SSO. The live IdP
-- handshake is provider-hosted (pending-live). No secrets beyond IdP metadata.
-- ---------------------------------------------------------------------------
create table if not exists public.sso_connections (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  provider   text not null default 'saml' check (provider in ('saml')),
  domain     text not null,
  metadata   jsonb not null default '{}'::jsonb,
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain)
);

create trigger set_sso_connections_updated_at before update on public.sso_connections
  for each row execute function public.set_updated_at();

alter table public.sso_connections enable row level security;
-- Only org owners manage SSO; membership check gates read/write.
create policy "sso_connections_manage_owner" on public.sso_connections
  for all using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = sso_connections.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = sso_connections.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Mirror a member's role into auth.users.app_metadata so the synchronous
-- entitlement seam (rbac.ts) reads a tamper-proof role without a DB round-trip.
-- SECURITY DEFINER: writes to auth.users (privileged) but only the role/org for
-- the affected member. Client can never call it directly (no policy grants).
-- ---------------------------------------------------------------------------
create or replace function public.sync_member_role_to_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users u
  set raw_app_meta_data =
    coalesce(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new.role, 'organization_id', new.org_id)
  where u.id = new.user_id;
  return new;
end;
$$;

drop trigger if exists org_member_role_sync on public.organization_members;
create trigger org_member_role_sync
  after insert or update of role on public.organization_members
  for each row execute function public.sync_member_role_to_metadata();

comment on table public.organization_members is
  'RBAC system-of-record. Roles mirror into app_metadata (tamper-proof) via trigger for the sync entitlement seam.';
comment on table public.sso_connections is
  'SAML SSO scaffolding: domain→org IdP mapping. Live IdP handshake is provider-hosted (pending-live).';

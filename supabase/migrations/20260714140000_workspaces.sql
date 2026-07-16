-- ============================================================================
-- Migration: workspaces (Phase 11.0 — Team Workspaces & Collaboration)
--
-- STRICTLY ADDITIVE — the tenancy safety contract:
--   • ZERO existing tables gain a workspace column. ZERO existing RLS policies
--     are altered, weakened, or dropped. All 107 owner-scoped policies remain
--     byte-for-byte identical → existing single-user behavior is unchanged by
--     construction (nothing about their access path changes).
--   • Collaboration is SHARE-BY-REFERENCE: `workspace_shares` points at a
--     resource the sharer owns. `resource_type` is CHECK-constrained to the
--     five shareable types — trades / psychology / habits / goals / AI reviews
--     are STRUCTURALLY unshareable. No role (incl. Owner/Coach/Manager) can
--     reach a member's personal data through this system.
--   • Six workspace roles map onto the LOCKED 9.2 three-role model:
--     `organization_members.role` (member/admin/owner + its CHECK + policies)
--     is untouched; the six-role label lives in the ADDITIVE `workspace_role`
--     column. DB rank stays authoritative for is_admin()/RLS.
--   • Every access path checks MEMBERSHIP + ROLE, never a bare workspace match.
--     Unknown state → deny (fail closed, enforced in code + policy shape).
--
-- Backfill safety: no backfill required — existing users have no workspace rows
-- and gain none; their personal scope IS the absence of workspace rows.
-- Idempotent + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- organization_members.workspace_role — ADDITIVE six-role label. The locked
-- three-role `role` column remains the authority rank; this refines display +
-- permission presets. Backfill-safe: default mirrors existing ranks.
-- ---------------------------------------------------------------------------
alter table public.organization_members
  add column if not exists workspace_role text not null default 'trader';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'org_members_workspace_role_chk'
  ) then
    alter table public.organization_members
      add constraint org_members_workspace_role_chk
      check (workspace_role in ('owner','admin','manager','coach','trader','viewer'));
  end if;
end $$;

-- Align labels for pre-existing rows (additive backfill; safe to re-run).
update public.organization_members set workspace_role = role
  where role in ('owner','admin') and workspace_role = 'trader';

-- ---------------------------------------------------------------------------
-- workspace_invitations — single-use, unguessable (256-bit), time-limited,
-- bound to email + workspace + role. RLS: the inviting workspace's admins/owner
-- manage them; acceptance happens via server action that re-validates the
-- authed user's email (no enumeration — uniform errors in code).
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_invitations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  invited_by     uuid not null references auth.users (id) on delete cascade,
  email          text not null,
  workspace_role text not null default 'trader'
                 check (workspace_role in ('admin','manager','coach','trader','viewer')),
  token          text not null unique,
  expires_at     timestamptz not null,
  accepted_at    timestamptz,
  declined_at    timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists ws_invitations_org_idx on public.workspace_invitations (org_id);
create index if not exists ws_invitations_token_idx on public.workspace_invitations (token);

drop trigger if exists set_ws_invitations_updated_at on public.workspace_invitations;
create trigger set_ws_invitations_updated_at before update on public.workspace_invitations
  for each row execute function public.set_updated_at();

alter table public.workspace_invitations enable row level security;

-- Membership + ROLE check (admin/owner of that org), never bare org match.
drop policy if exists "ws_invitations_manage_admin" on public.workspace_invitations;
create policy "ws_invitations_manage_admin" on public.workspace_invitations
  for all using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = workspace_invitations.org_id
        and m.user_id = auth.uid()
        and m.role in ('admin','owner')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = workspace_invitations.org_id
        and m.user_id = auth.uid()
        and m.role in ('admin','owner')
    )
  );

-- ---------------------------------------------------------------------------
-- workspace_shares — explicit, revocable, per-resource sharing. The CHECK on
-- resource_type is the privacy guarantee: personal data types cannot exist here.
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_shares (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  shared_by     uuid not null references auth.users (id) on delete cascade,
  resource_type text not null
                check (resource_type in ('strategy','playbook','report','tag','template')),
  resource_id   uuid not null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, resource_type, resource_id)
);
create index if not exists ws_shares_org_idx on public.workspace_shares (org_id);
create index if not exists ws_shares_owner_idx on public.workspace_shares (shared_by);

drop trigger if exists set_ws_shares_updated_at on public.workspace_shares;
create trigger set_ws_shares_updated_at before update on public.workspace_shares
  for each row execute function public.set_updated_at();

alter table public.workspace_shares enable row level security;

-- The sharer manages their own shares (create/revoke).
drop policy if exists "ws_shares_manage_own" on public.workspace_shares;
create policy "ws_shares_manage_own" on public.workspace_shares
  for all using (auth.uid() = shared_by) with check (auth.uid() = shared_by);

-- Workspace members may SEE unrevoked share rows (membership check, any role —
-- the referenced resource itself is fetched via a server action that enforces
-- the role matrix; this row exposes only type + id, never resource content).
drop policy if exists "ws_shares_select_member" on public.workspace_shares;
create policy "ws_shares_select_member" on public.workspace_shares
  for select using (
    revoked_at is null
    and exists (
      select 1 from public.organization_members m
      where m.org_id = workspace_shares.org_id and m.user_id = auth.uid()
    )
  );

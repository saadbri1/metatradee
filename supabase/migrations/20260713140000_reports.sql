-- ============================================================================
-- Migration: reports (Phase 9.13 — Reports, Export & Insights Center)
--
-- Reports are DEFINITIONS (blocks + filters) rendered from existing engine
-- outputs (9.8–9.12); no metric math is stored here. Sharing is a security
-- surface: shares carry a SANITIZED SNAPSHOT payload (already projected — no raw
-- account, no other reports, psychology excluded unless opted in and never
-- public), an unguessable token, optional expiry + salted-hash password, and
-- view-only vs download. Token-gated viewing goes through SECURITY DEFINER
-- functions so anonymous viewers never touch RLS-protected owner data.
--
-- Idempotent + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reports — a saved report/template definition. `blocks` + `filters` reproduce
-- the exact scope so regeneration/schedules are deterministic.
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  type           text not null check (type in (
                   'daily','weekly','monthly','quarterly','yearly','custom','strategy',
                   'broker','account','session','symbol','risk','psychology',
                   'goal_progress','ai_performance','executive')),
  title          text not null,
  blocks         text[] not null default '{}',
  filters        jsonb not null default '{}'::jsonb,
  note           text,
  is_template    boolean not null default false,
  template_version integer not null default 1,
  is_favorite    boolean not null default false,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index if not exists reports_user_idx on public.reports (user_id, updated_at desc);

create trigger set_reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;
create policy "reports_all_own" on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- report_shares — a token-gated, sanitized snapshot of a report. `payload` is
-- the projected SharedReport (psychology already excluded unless opted in). The
-- raw report is never re-read at view time, so over-fetch is impossible.
-- ---------------------------------------------------------------------------
create table if not exists public.report_shares (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  report_id          uuid not null references public.reports (id) on delete cascade,
  token              text not null unique,
  payload            jsonb not null,
  allow_download     boolean not null default false,
  is_public          boolean not null default false,
  include_psychology boolean not null default false,
  password_salt      text,
  password_hash      text,
  expires_at         timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Psychology data is NEVER part of a public share (defense in depth vs app).
  constraint report_shares_public_no_psych check (not (is_public and include_psychology))
);
create index if not exists report_shares_user_idx on public.report_shares (user_id, created_at desc);
create index if not exists report_shares_token_idx on public.report_shares (token);

create trigger set_report_shares_updated_at before update on public.report_shares
  for each row execute function public.set_updated_at();

alter table public.report_shares enable row level security;
-- Owner manages own shares. Anonymous viewing goes through the SECURITY DEFINER
-- functions below (no broad SELECT policy — the raw table stays owner-only).
create policy "report_shares_all_own" on public.report_shares
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Returns {locked:true} for password shares (verify separately), the sanitized
-- payload for open live shares, or null when missing/expired/revoked.
create or replace function public.report_share_fetch(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.report_shares%rowtype;
begin
  select * into s from public.report_shares where token = p_token;
  if not found then return null; end if;
  if s.revoked_at is not null then return null; end if;
  if s.expires_at is not null and s.expires_at <= now() then return null; end if;
  if s.password_hash is not null then
    return jsonb_build_object('locked', true, 'allowDownload', s.allow_download);
  end if;
  return s.payload;
end;
$$;

-- Verifies a share password (salted sha256, base64) and returns the payload.
create or replace function public.report_share_verify(p_token text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.report_shares%rowtype;
  computed text;
begin
  select * into s from public.report_shares where token = p_token;
  if not found or s.revoked_at is not null then return null; end if;
  if s.expires_at is not null and s.expires_at <= now() then return null; end if;
  if s.password_hash is null then return s.payload; end if;
  computed := encode(digest(s.password_salt || ':' || p_password, 'sha256'), 'base64');
  if computed = s.password_hash then return s.payload; end if;
  return jsonb_build_object('locked', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- report_schedules — automated generation/delivery. Scheduler runs in the async
-- plane (documented seam); respects user_preferences timezone. Mutable + pausable.
-- ---------------------------------------------------------------------------
create table if not exists public.report_schedules (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  report_id         uuid not null references public.reports (id) on delete cascade,
  frequency         text not null check (frequency in ('daily','weekly','monthly','quarterly','yearly','custom')),
  deliver_email     boolean not null default true,
  deliver_dashboard boolean not null default true,
  is_paused         boolean not null default false,
  next_run_at       timestamptz,
  last_run_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists report_schedules_user_idx on public.report_schedules (user_id);
create index if not exists report_schedules_due_idx on public.report_schedules (next_run_at) where not is_paused;

create trigger set_report_schedules_updated_at before update on public.report_schedules
  for each row execute function public.set_updated_at();

alter table public.report_schedules enable row level security;
create policy "report_schedules_all_own" on public.report_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- export_jobs — async export generation. Heavy formats (PDF/xlsx/large CSV) are
-- queued; the artifact lands in object storage and is served via a signed URL.
-- ---------------------------------------------------------------------------
create table if not exists public.export_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  report_id     uuid references public.reports (id) on delete set null,
  format        text not null check (format in ('pdf','csv','xlsx','json','print')),
  status        text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  artifact_path text,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists export_jobs_user_idx on public.export_jobs (user_id, created_at desc);

create trigger set_export_jobs_updated_at before update on public.export_jobs
  for each row execute function public.set_updated_at();

alter table public.export_jobs enable row level security;
create policy "export_jobs_all_own" on public.export_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- report_events — APPEND-ONLY audit of exports + share create/access/revoke.
-- Owner reads own; insert own. No update/delete (immutable trail).
-- ---------------------------------------------------------------------------
create table if not exists public.report_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  report_id  uuid references public.reports (id) on delete set null,
  event_type text not null check (event_type in (
              'export_generated','share_created','share_accessed','share_revoked')),
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists report_events_user_idx on public.report_events (user_id, created_at desc);

alter table public.report_events enable row level security;
create policy "report_events_select_own" on public.report_events
  for select using (auth.uid() = user_id);
create policy "report_events_insert_own" on public.report_events
  for insert with check (auth.uid() = user_id);

comment on table public.report_events is
  'Append-only audit of report exports and share lifecycle. Owner read/insert only.';

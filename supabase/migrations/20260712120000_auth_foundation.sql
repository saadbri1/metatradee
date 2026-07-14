-- ============================================================================
-- Migration: auth_foundation
-- Phase 9.2 — Enterprise Authentication (supplementary data only)
--
-- Purpose
--   Adds the supplementary tables that hang off Supabase's built-in `auth.users`
--   WITHOUT duplicating anything auth.users already owns (email, password hash,
--   provider identities, email_confirmed_at). Everything here is either
--   public-safe profile data or per-user configuration, plus an append-only
--   security audit log.
--
-- Tables
--   public.profiles          1:1 with auth.users. Public-safe profile fields.
--   public.user_preferences  Per-user UX preferences (owner-only).
--   public.user_settings     Security-adjacent, non-sensitive toggles (owner-only).
--   public.audit_logs        Append-only auth/security events (server-write only).
--
-- Automation
--   public.handle_new_user()      Security-definer; seeds profile + prefs + settings
--                                 on new auth.users row.
--   public.handle_user_updated()  Keeps profiles.is_verified in sync with
--                                 auth.users.email_confirmed_at.
--   public.log_audit_event(...)   Security-definer; the ONLY write path into
--                                 audit_logs. Never trusts a client-supplied user id
--                                 (always uses auth.uid()).
--   public.set_updated_at()       Standard updated_at touch trigger.
--
-- Safety
--   Idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS) so it is
--   safe to re-run on an existing database. RLS is enabled on every table with
--   least-privilege, owner-scoped policies. Full rollback lives in the paired
--   `*.down.sql` file.
-- ============================================================================

-- Case-insensitive text for usernames.
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Shared helper: touch updated_at on UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users. Public-safe columns only.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     citext unique,
  display_name text,
  avatar_url   text,
  persona      text,
  is_verified  boolean not null default false,
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_len
    check (username is null or char_length(username::text) between 3 and 32),
  constraint profiles_persona_chk
    check (persona is null or persona in ('retail', 'funded', 'prop', 'institutional'))
);

comment on table public.profiles is
  '1:1 supplementary profile for auth.users. Public-safe fields only; no PII beyond display data.';

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Public read is allowed ONLY for rows the owner has explicitly shared.
-- Callers must still select public-safe columns; column privacy is enforced in app.
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (is_public = true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- user_preferences — per-user UX preferences. Owner-only.
-- ---------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  theme          text not null default 'system'
                 check (theme in ('light', 'dark', 'system')),
  language       text not null default 'en',
  timezone       text not null default 'UTC',
  density        text not null default 'comfortable'
                 check (density in ('comfortable', 'compact', 'terminal')),
  reduced_motion boolean not null default false,
  notify_email   boolean not null default true,
  notify_push    boolean not null default false,
  notify_product boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.user_preferences is 'Per-user UX preferences. Owner-only via RLS.';

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
  on public.user_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_settings — security-adjacent, non-sensitive toggles. Owner-only.
-- Kept separate from user_preferences per the data-separation convention.
-- mfa_enabled is a SEAM for a later MFA phase (not implemented now).
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  mfa_enabled         boolean not null default false, -- seam: MFA phase
  login_notifications boolean not null default true,
  security_alerts     boolean not null default true,
  feature_flags       jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.user_settings is
  'Security-adjacent, non-sensitive per-user settings and feature toggles. Owner-only via RLS.';

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- audit_logs — append-only security event log.
-- No client INSERT/UPDATE/DELETE policy exists ⇒ RLS denies all client writes.
-- The only write path is public.log_audit_event() (security definer).
-- Users may read ONLY their own events.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  event_type text not null,
  ip         inet,
  user_agent text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only auth/security audit trail. Client-write denied by RLS; write only via public.log_audit_event().';

create index if not exists audit_logs_user_id_created_at_idx
  on public.audit_logs (user_id, created_at desc);
create index if not exists audit_logs_event_type_idx
  on public.audit_logs (event_type);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own"
  on public.audit_logs for select
  using (auth.uid() = user_id);
-- NOTE: intentionally no insert/update/delete policy → all client writes denied.

-- ---------------------------------------------------------------------------
-- log_audit_event — sole write path into audit_logs.
-- Security definer so it can bypass RLS, but it ALWAYS stamps auth.uid()
-- (never a client-supplied id) so events cannot be spoofed. ip/ua are captured
-- server-side and passed in; a bad ip cast degrades to NULL rather than failing.
-- ---------------------------------------------------------------------------
create or replace function public.log_audit_event(
  p_event_type text,
  p_metadata   jsonb default '{}'::jsonb,
  p_ip         text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip inet;
begin
  begin
    v_ip := nullif(p_ip, '')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.audit_logs (user_id, event_type, ip, user_agent, metadata)
  values (auth.uid(), p_event_type, v_ip, p_user_agent, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.log_audit_event(text, jsonb, text, text) from public;
grant execute on function public.log_audit_event(text, jsonb, text, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- handle_new_user — seed supplementary rows when a user is created.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- handle_user_updated — mirror email verification state into profiles.
-- ---------------------------------------------------------------------------
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_verified = (new.email_confirmed_at is not null)
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_updated();

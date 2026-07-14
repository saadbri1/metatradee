-- ============================================================================
-- Migration: database_core (Phase 9.3)
--
-- Purpose
--   Core per-user domain tables that later features (Journal, Analytics, AI)
--   build on, plus workspace-default provisioning. Builds ON TOP of the 9.2
--   auth foundation — it reuses public.set_updated_at() and extends the
--   existing public.handle_new_user() trigger; it never redefines 9.2 tables.
--
-- Tables (all: UUID PK, user_id → auth.users ON DELETE CASCADE, RLS owner-scoped,
--         created_at/updated_at via set_updated_at, user_id index, soft-delete
--         where meaningful):
--   public.strategies         User strategies / playbooks.
--   public.tags               User taxonomy (setup/mistake/emotion/custom).
--   public.attachments        File metadata (avatars now; screenshots later).
--   public.trading_accounts   Brokerage / prop / demo accounts.
--
-- Provisioning
--   public.ensure_workspace_defaults(uuid)  Idempotent seeding of starter tags +
--     a default strategy. Wired into handle_new_user AND callable by the app on
--     first login for pre-existing users. Safe under concurrent calls (relies on
--     unique indexes + ON CONFLICT DO NOTHING).
--
-- Conventions match 9.2: text + CHECK (not native enums) for enumerations,
-- DROP POLICY IF EXISTS + CREATE POLICY, fully idempotent. Rollback in the
-- paired *.down.sql.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- strategies
-- ---------------------------------------------------------------------------
create table if not exists public.strategies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  color       text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint strategies_name_len check (char_length(name) between 1 and 80),
  constraint strategies_color_hex check (color is null or color ~ '^#[0-9A-Fa-f]{6}$')
);

comment on table public.strategies is 'User trading strategies / playbooks. Owner-only via RLS.';

create unique index if not exists strategies_user_name_uniq
  on public.strategies (user_id, lower(name))
  where deleted_at is null;
create index if not exists strategies_user_id_idx on public.strategies (user_id);

drop trigger if exists set_strategies_updated_at on public.strategies;
create trigger set_strategies_updated_at
  before update on public.strategies
  for each row execute function public.set_updated_at();

alter table public.strategies enable row level security;

drop policy if exists "strategies_select_own" on public.strategies;
create policy "strategies_select_own" on public.strategies
  for select using (auth.uid() = user_id);
drop policy if exists "strategies_insert_own" on public.strategies;
create policy "strategies_insert_own" on public.strategies
  for insert with check (auth.uid() = user_id);
drop policy if exists "strategies_update_own" on public.strategies;
create policy "strategies_update_own" on public.strategies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "strategies_delete_own" on public.strategies;
create policy "strategies_delete_own" on public.strategies
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  category   text not null default 'custom'
             check (category in ('setup', 'mistake', 'emotion', 'custom')),
  color      text,
  is_system  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_name_len check (char_length(name) between 1 and 40),
  constraint tags_color_hex check (color is null or color ~ '^#[0-9A-Fa-f]{6}$')
);

comment on table public.tags is 'User taxonomy for setups/mistakes/emotions. Owner-only via RLS.';

create unique index if not exists tags_user_category_name_uniq
  on public.tags (user_id, category, lower(name));
create index if not exists tags_user_id_idx on public.tags (user_id);

drop trigger if exists set_tags_updated_at on public.tags;
create trigger set_tags_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

alter table public.tags enable row level security;

drop policy if exists "tags_select_own" on public.tags;
create policy "tags_select_own" on public.tags
  for select using (auth.uid() = user_id);
drop policy if exists "tags_insert_own" on public.tags;
create policy "tags_insert_own" on public.tags
  for insert with check (auth.uid() = user_id);
drop policy if exists "tags_update_own" on public.tags;
create policy "tags_update_own" on public.tags
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tags_delete_own" on public.tags;
create policy "tags_delete_own" on public.tags
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- attachments — generic file metadata. Path-scoped to the owner; the file bytes
-- live in Supabase Storage (see the storage migration). (bucket, path) unique so
-- replace-old-on-new never orphans a row.
-- ---------------------------------------------------------------------------
create table if not exists public.attachments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  bucket     text not null,
  path       text not null,
  kind       text not null default 'other'
             check (kind in ('avatar', 'screenshot', 'document', 'other')),
  mime_type  text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  width      integer check (width is null or width >= 0),
  height     integer check (height is null or height >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint attachments_bucket_path_uniq unique (bucket, path)
);

comment on table public.attachments is 'File metadata (avatars, later screenshots). Owner-only via RLS.';

create index if not exists attachments_user_id_idx on public.attachments (user_id);
create index if not exists attachments_user_kind_idx on public.attachments (user_id, kind);

drop trigger if exists set_attachments_updated_at on public.attachments;
create trigger set_attachments_updated_at
  before update on public.attachments
  for each row execute function public.set_updated_at();

alter table public.attachments enable row level security;

drop policy if exists "attachments_select_own" on public.attachments;
create policy "attachments_select_own" on public.attachments
  for select using (auth.uid() = user_id);
drop policy if exists "attachments_insert_own" on public.attachments;
create policy "attachments_insert_own" on public.attachments
  for insert with check (auth.uid() = user_id);
drop policy if exists "attachments_update_own" on public.attachments;
create policy "attachments_update_own" on public.attachments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "attachments_delete_own" on public.attachments;
create policy "attachments_delete_own" on public.attachments
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- trading_accounts
-- ---------------------------------------------------------------------------
create table if not exists public.trading_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  broker           text,
  account_type     text not null default 'live'
                   check (account_type in ('live', 'demo', 'prop', 'backtest')),
  base_currency    char(3) not null default 'USD'
                   check (base_currency ~ '^[A-Z]{3}$'),
  starting_balance numeric(20, 2) not null default 0 check (starting_balance >= 0),
  status           text not null default 'active'
                   check (status in ('active', 'archived')),
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint trading_accounts_name_len check (char_length(name) between 1 and 80)
);

comment on table public.trading_accounts is 'Brokerage / prop / demo accounts. Owner-only via RLS.';

create index if not exists trading_accounts_user_id_idx on public.trading_accounts (user_id);
-- At most one default (non-deleted) account per user.
create unique index if not exists trading_accounts_one_default
  on public.trading_accounts (user_id)
  where is_default and deleted_at is null;

drop trigger if exists set_trading_accounts_updated_at on public.trading_accounts;
create trigger set_trading_accounts_updated_at
  before update on public.trading_accounts
  for each row execute function public.set_updated_at();

alter table public.trading_accounts enable row level security;

drop policy if exists "trading_accounts_select_own" on public.trading_accounts;
create policy "trading_accounts_select_own" on public.trading_accounts
  for select using (auth.uid() = user_id);
drop policy if exists "trading_accounts_insert_own" on public.trading_accounts;
create policy "trading_accounts_insert_own" on public.trading_accounts
  for insert with check (auth.uid() = user_id);
drop policy if exists "trading_accounts_update_own" on public.trading_accounts;
create policy "trading_accounts_update_own" on public.trading_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "trading_accounts_delete_own" on public.trading_accounts;
create policy "trading_accounts_delete_own" on public.trading_accounts
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ensure_workspace_defaults — idempotent starter data. Safe to call repeatedly
-- and under concurrent first-login requests (unique indexes + ON CONFLICT).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_workspace_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Prefer the caller's own session id; fall back to the argument only when
  -- there is no session (the signup trigger, or a service_role call). This
  -- prevents an authenticated user from seeding rows into someone else's
  -- account by passing a different id.
  v_uid uuid := coalesce(auth.uid(), p_user_id);
begin
  if v_uid is null then
    return;
  end if;

  -- Starter tags (unique per user+category+lower(name) → no duplicates).
  insert into public.tags (user_id, name, category, is_system) values
    (v_uid, 'Breakout', 'setup', true),
    (v_uid, 'Reversal', 'setup', true),
    (v_uid, 'Trend Continuation', 'setup', true),
    (v_uid, 'FOMO', 'mistake', true),
    (v_uid, 'Overtrading', 'mistake', true),
    (v_uid, 'Moved Stop', 'mistake', true),
    (v_uid, 'Calm', 'emotion', true),
    (v_uid, 'Anxious', 'emotion', true),
    (v_uid, 'Confident', 'emotion', true)
  on conflict do nothing;

  -- Default strategy placeholder (unique per user+lower(name) where not deleted).
  insert into public.strategies (user_id, name, description)
  values (
    v_uid,
    'My First Strategy',
    'A starter strategy — rename or edit it to match your edge.'
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.ensure_workspace_defaults(uuid) from public;
grant execute on function public.ensure_workspace_defaults(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Extend handle_new_user (from 9.2) to also seed workspace defaults. Body is the
-- 9.2 version PLUS the ensure_workspace_defaults call; CREATE OR REPLACE keeps it
-- idempotent and the trigger binding unchanged.
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

  -- 9.3: seed starter tags + default strategy.
  perform public.ensure_workspace_defaults(new.id);

  return new;
end;
$$;

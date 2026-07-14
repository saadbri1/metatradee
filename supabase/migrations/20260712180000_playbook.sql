-- ============================================================================
-- Migration: playbook (Phase 9.10 — Playbook & Strategy Management)
--
-- EXTENDS the existing 9.3 `strategies` table (used by 9.6 trades) — never
-- recreates it; the trades.strategy_id link is preserved. Rule groups are typed
-- JSONB arrays of {id,text,required} (queryable + versionable, not one opaque
-- blob). Adds playbooks, version snapshots (append-only), templates (marketplace-
-- ready schema), and per-trade adherence (references the strategy version in
-- force at trade time). Strategy performance is NOT stored — it is computed via
-- the 9.8 engine so it reconciles with Analytics.
--
-- Idempotent + reversible (paired *.down.sql). RLS owner-scoped on every table.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- strategies: add playbook fields (preserve existing columns + trade link).
-- ---------------------------------------------------------------------------
alter table public.strategies add column if not exists category text;
alter table public.strategies add column if not exists market text;
alter table public.strategies add column if not exists asset_class text;
alter table public.strategies add column if not exists symbols text[] not null default '{}';
alter table public.strategies add column if not exists timeframes text[] not null default '{}';
alter table public.strategies add column if not exists sessions text[] not null default '{}';
alter table public.strategies add column if not exists entry_rules jsonb not null default '[]'::jsonb;
alter table public.strategies add column if not exists exit_rules jsonb not null default '[]'::jsonb;
alter table public.strategies add column if not exists stop_loss_rules jsonb not null default '[]'::jsonb;
alter table public.strategies add column if not exists take_profit_rules jsonb not null default '[]'::jsonb;
alter table public.strategies add column if not exists position_sizing_rules jsonb not null default '[]'::jsonb;
alter table public.strategies add column if not exists risk_rules jsonb not null default '[]'::jsonb;
alter table public.strategies add column if not exists confirmation_rules jsonb not null default '[]'::jsonb;
alter table public.strategies add column if not exists invalidation_rules jsonb not null default '[]'::jsonb;
alter table public.strategies add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.strategies add column if not exists notes text;
alter table public.strategies add column if not exists status text not null default 'active';
alter table public.strategies add column if not exists current_version integer not null default 1;
alter table public.strategies add column if not exists is_pinned boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'strategies_status_chk') then
    alter table public.strategies
      add constraint strategies_status_chk check (status in ('draft', 'active', 'archived'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- playbooks + join (many-to-many, section/order).
-- ---------------------------------------------------------------------------
create table if not exists public.playbooks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  category    text,
  is_favorite boolean not null default false,
  status      text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint playbooks_name_len check (char_length(name) between 1 and 80)
);
create index if not exists playbooks_user_idx on public.playbooks (user_id);
create unique index if not exists playbooks_user_name_uniq
  on public.playbooks (user_id, lower(name)) where deleted_at is null;

drop trigger if exists set_playbooks_updated_at on public.playbooks;
create trigger set_playbooks_updated_at before update on public.playbooks
  for each row execute function public.set_updated_at();

alter table public.playbooks enable row level security;
drop policy if exists "playbooks_all_own" on public.playbooks;
create policy "playbooks_all_own" on public.playbooks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.playbook_strategies (
  playbook_id uuid not null references public.playbooks (id) on delete cascade,
  strategy_id uuid not null references public.strategies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  section     text,
  position    integer not null default 0,
  primary key (playbook_id, strategy_id)
);
create index if not exists playbook_strategies_user_idx on public.playbook_strategies (user_id);

alter table public.playbook_strategies enable row level security;
drop policy if exists "playbook_strategies_all_own" on public.playbook_strategies;
create policy "playbook_strategies_all_own" on public.playbook_strategies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- strategy_versions — immutable append-only snapshots.
-- ---------------------------------------------------------------------------
create table if not exists public.strategy_versions (
  id          uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  version     integer not null,
  content     jsonb not null,
  change_note text,
  created_at  timestamptz not null default now(),
  unique (strategy_id, version)
);
create index if not exists strategy_versions_strategy_idx on public.strategy_versions (strategy_id, version desc);

alter table public.strategy_versions enable row level security;
-- Append-only: owner may insert + read; NO update/delete policy (immutable).
drop policy if exists "strategy_versions_select_own" on public.strategy_versions;
create policy "strategy_versions_select_own" on public.strategy_versions
  for select using (auth.uid() = user_id);
drop policy if exists "strategy_versions_insert_own" on public.strategy_versions;
create policy "strategy_versions_insert_own" on public.strategy_versions
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- strategy_templates — user + default (user_id null = global default), with a
-- schema_version for forward-compatible marketplace consumption (SEAM).
-- ---------------------------------------------------------------------------
create table if not exists public.strategy_templates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete cascade, -- null = default
  name           text not null,
  schema_version integer not null default 1,
  author         text,
  content        jsonb not null,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint strategy_templates_name_len check (char_length(name) between 1 and 80)
);
create index if not exists strategy_templates_user_idx on public.strategy_templates (user_id);

drop trigger if exists set_strategy_templates_updated_at on public.strategy_templates;
create trigger set_strategy_templates_updated_at before update on public.strategy_templates
  for each row execute function public.set_updated_at();

alter table public.strategy_templates enable row level security;
-- Read own + global defaults; write own only.
drop policy if exists "strategy_templates_select" on public.strategy_templates;
create policy "strategy_templates_select" on public.strategy_templates
  for select using (user_id is null or auth.uid() = user_id);
drop policy if exists "strategy_templates_insert_own" on public.strategy_templates;
create policy "strategy_templates_insert_own" on public.strategy_templates
  for insert with check (auth.uid() = user_id);
drop policy if exists "strategy_templates_update_own" on public.strategy_templates;
create policy "strategy_templates_update_own" on public.strategy_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "strategy_templates_delete_own" on public.strategy_templates;
create policy "strategy_templates_delete_own" on public.strategy_templates
  for delete using (auth.uid() = user_id);

-- Seed a default starter template (global, idempotent).
insert into public.strategy_templates (user_id, name, schema_version, author, is_default, content)
select null, 'SMC / ICT Starter', 1, 'MetaTradee', true, jsonb_build_object(
  'category', 'Smart Money Concepts',
  'entry_rules', jsonb_build_array(
    jsonb_build_object('id', 'e1', 'text', 'Price sweeps liquidity then displaces', 'required', true),
    jsonb_build_object('id', 'e2', 'text', 'Entry on FVG / order block retrace', 'required', true)),
  'exit_rules', jsonb_build_array(
    jsonb_build_object('id', 'x1', 'text', 'Take profit at opposing liquidity', 'required', false)),
  'checklist', jsonb_build_array(
    jsonb_build_object('id', 'c1', 'text', 'HTF bias confirmed', 'required', true),
    jsonb_build_object('id', 'c2', 'text', 'Killzone timing', 'required', true),
    jsonb_build_object('id', 'c3', 'text', 'Risk ≤ 1%', 'required', true))
)
where not exists (
  select 1 from public.strategy_templates where is_default and name = 'SMC / ICT Starter'
);

-- ---------------------------------------------------------------------------
-- trade_strategy_adherence — one row per trade; references the strategy VERSION
-- in force at trade time (so later edits don't rewrite history).
-- ---------------------------------------------------------------------------
create table if not exists public.trade_strategy_adherence (
  trade_id                uuid primary key references public.trades (id) on delete cascade,
  user_id                 uuid not null references auth.users (id) on delete cascade,
  strategy_id             uuid references public.strategies (id) on delete set null,
  strategy_version        integer,
  followed_strategy       boolean,
  checklist_completed_pct numeric(5, 2),
  rule_violations         text[] not null default '{}',
  execution_quality       smallint check (execution_quality is null or execution_quality between 0 and 100),
  confidence              smallint check (confidence is null or confidence between 0 and 100),
  mistakes                text[] not null default '{}',
  lessons                 text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists trade_adherence_strategy_idx on public.trade_strategy_adherence (user_id, strategy_id);

drop trigger if exists set_trade_adherence_updated_at on public.trade_strategy_adherence;
create trigger set_trade_adherence_updated_at before update on public.trade_strategy_adherence
  for each row execute function public.set_updated_at();

alter table public.trade_strategy_adherence enable row level security;
drop policy if exists "trade_adherence_all_own" on public.trade_strategy_adherence;
create policy "trade_adherence_all_own" on public.trade_strategy_adherence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

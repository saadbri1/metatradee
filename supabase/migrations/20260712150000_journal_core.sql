-- ============================================================================
-- Migration: journal_core (Phase 9.6 — Trading Journal Engine)
--
-- Purpose
--   The product's core: logical trades + organization, built on 9.3's
--   trading_accounts/strategies/tags and 9.2's auth. Money uses EXACT numeric
--   types (never float). Derived fields (pnl/net_pnl/rr_ratio/duration_seconds)
--   are written server-side by a single shared compute function (see
--   src/features/journal/derived.ts) — NOT client-fabricated. A content_hash
--   column supports duplicate detection (reused by the future import engine).
--
--   brokers                Global read-only reference (platform metadata).
--   trades                 Logical trade (one row per trade). RLS owner-only.
--   trade_tags             Trade↔tag join (many-to-many). RLS owner-only.
--   saved_filters          Per-user saved filter/sort presets. RLS owner-only.
--   trade_collections      Folders/collections. RLS owner-only.
--   trade_collection_items Collection↔trade join. RLS owner-only.
--
-- Idempotent + reversible (paired *.down.sql). Reuses set_updated_at. text+CHECK
-- enums per the established convention.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- brokers — global reference list (no user_id). Readable by any authenticated
-- user; not client-writable. Seeded with the platforms the import engine targets.
-- ---------------------------------------------------------------------------
create table if not exists public.brokers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  platform   text,
  created_at timestamptz not null default now()
);

comment on table public.brokers is 'Global broker/platform reference. Read-only to clients.';

alter table public.brokers enable row level security;

drop policy if exists "brokers_select_all" on public.brokers;
create policy "brokers_select_all" on public.brokers
  for select to authenticated using (true);
-- No insert/update/delete policy → clients cannot write (seeded via migration).

insert into public.brokers (name, slug, platform) values
  ('MetaTrader 4', 'mt4', 'MetaTrader'),
  ('MetaTrader 5', 'mt5', 'MetaTrader'),
  ('cTrader', 'ctrader', 'cTrader'),
  ('DXtrade', 'dxtrade', 'DXtrade'),
  ('MatchTrader', 'matchtrader', 'MatchTrader'),
  ('TradeLocker', 'tradelocker', 'TradeLocker'),
  ('Generic CSV', 'generic-csv', 'CSV')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- trades — logical trade. Exact numeric money; server-computed derived fields.
-- ---------------------------------------------------------------------------
create table if not exists public.trades (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  trading_account_id uuid references public.trading_accounts (id) on delete set null,
  broker_id          uuid references public.brokers (id) on delete set null,
  strategy_id        uuid references public.strategies (id) on delete set null,

  market      text,
  symbol      text not null,
  asset_type  text check (asset_type in ('forex','stocks','futures','crypto','options','commodities','index','other')),
  direction   text not null check (direction in ('buy','sell')),

  entry_price   numeric(24,8),
  exit_price    numeric(24,8),
  quantity      numeric(28,10),
  position_size numeric(28,10),
  stop_loss     numeric(24,8),
  take_profit   numeric(24,8),

  risk_percent numeric(6,2),
  risk_amount  numeric(20,2),
  reward       numeric(20,2),
  rr_ratio     numeric(10,2),        -- derived
  commission   numeric(20,2) not null default 0,
  swap         numeric(20,2) not null default 0,
  fees         numeric(20,2) not null default 0,
  pnl          numeric(20,2),        -- derived (gross)
  net_pnl      numeric(20,2),        -- derived (net of costs)
  currency     char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),

  opened_at        timestamptz,
  closed_at        timestamptz,
  executed_at      timestamptz,
  duration_seconds bigint,           -- derived

  session      text check (session in ('asian','london','new_york','sydney')),
  setup        text,
  confidence   smallint check (confidence is null or confidence between 0 and 100),
  notes        text,
  private_notes text,                -- NEVER exposed via any shared/visibility path
  visibility   text not null default 'private' check (visibility in ('private','shared')),
  status       text not null default 'published' check (status in ('draft','published')),
  source       text not null default 'manual' check (source in ('manual','imported')),
  import_id    uuid,                 -- set by the import engine (9.7); FK added there
  content_hash text,                 -- duplicate-detection key

  is_favorite boolean not null default false,
  is_pinned   boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  archived_at timestamptz,

  constraint trades_symbol_len check (char_length(symbol) between 1 and 40),
  constraint trades_quantity_nonneg check (quantity is null or quantity >= 0),
  constraint trades_prices_nonneg check (
    (entry_price is null or entry_price >= 0) and
    (exit_price is null or exit_price >= 0)
  ),
  constraint trades_close_after_open check (
    opened_at is null or closed_at is null or closed_at >= opened_at
  )
);

comment on table public.trades is 'Logical trades. Owner-only RLS. Money exact-numeric; derived fields server-written.';

-- Main list query: owner's non-deleted trades, newest close first (keyset).
create index if not exists trades_list_idx
  on public.trades (user_id, deleted_at, closed_at desc, id desc);
create index if not exists trades_user_id_idx on public.trades (user_id);
create index if not exists trades_account_idx on public.trades (trading_account_id);
create index if not exists trades_content_hash_idx on public.trades (user_id, content_hash);
create index if not exists trades_symbol_idx on public.trades (user_id, symbol);

drop trigger if exists set_trades_updated_at on public.trades;
create trigger set_trades_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

alter table public.trades enable row level security;

drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own" on public.trades
  for select using (auth.uid() = user_id);
drop policy if exists "trades_insert_own" on public.trades;
create policy "trades_insert_own" on public.trades
  for insert with check (auth.uid() = user_id);
drop policy if exists "trades_update_own" on public.trades;
create policy "trades_update_own" on public.trades
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "trades_delete_own" on public.trades;
create policy "trades_delete_own" on public.trades
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- trade_tags — many-to-many. Denormalized user_id for simple, indexed RLS.
-- ---------------------------------------------------------------------------
create table if not exists public.trade_tags (
  trade_id uuid not null references public.trades (id) on delete cascade,
  tag_id   uuid not null references public.tags (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  primary key (trade_id, tag_id)
);

create index if not exists trade_tags_tag_idx on public.trade_tags (user_id, tag_id);

alter table public.trade_tags enable row level security;

drop policy if exists "trade_tags_select_own" on public.trade_tags;
create policy "trade_tags_select_own" on public.trade_tags
  for select using (auth.uid() = user_id);
drop policy if exists "trade_tags_insert_own" on public.trade_tags;
create policy "trade_tags_insert_own" on public.trade_tags
  for insert with check (auth.uid() = user_id);
drop policy if exists "trade_tags_delete_own" on public.trade_tags;
create policy "trade_tags_delete_own" on public.trade_tags
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- saved_filters — per-user filter/sort presets.
-- ---------------------------------------------------------------------------
create table if not exists public.saved_filters (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  filters    jsonb not null default '{}'::jsonb,
  sort       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_filters_name_len check (char_length(name) between 1 and 60)
);

create index if not exists saved_filters_user_idx on public.saved_filters (user_id);

drop trigger if exists set_saved_filters_updated_at on public.saved_filters;
create trigger set_saved_filters_updated_at
  before update on public.saved_filters
  for each row execute function public.set_updated_at();

alter table public.saved_filters enable row level security;

drop policy if exists "saved_filters_all_own" on public.saved_filters;
create policy "saved_filters_all_own" on public.saved_filters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- trade_collections + items — folders/collections (organization).
-- ---------------------------------------------------------------------------
create table if not exists public.trade_collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  color      text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint trade_collections_name_len check (char_length(name) between 1 and 60)
);

create unique index if not exists trade_collections_user_name_uniq
  on public.trade_collections (user_id, lower(name))
  where deleted_at is null;

drop trigger if exists set_trade_collections_updated_at on public.trade_collections;
create trigger set_trade_collections_updated_at
  before update on public.trade_collections
  for each row execute function public.set_updated_at();

alter table public.trade_collections enable row level security;

drop policy if exists "trade_collections_all_own" on public.trade_collections;
create policy "trade_collections_all_own" on public.trade_collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.trade_collection_items (
  collection_id uuid not null references public.trade_collections (id) on delete cascade,
  trade_id      uuid not null references public.trades (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (collection_id, trade_id)
);

create index if not exists trade_collection_items_trade_idx
  on public.trade_collection_items (user_id, trade_id);

alter table public.trade_collection_items enable row level security;

drop policy if exists "trade_collection_items_all_own" on public.trade_collection_items;
create policy "trade_collection_items_all_own" on public.trade_collection_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

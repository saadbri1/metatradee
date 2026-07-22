-- Account-aware dashboard foundation. Additive and owner-scoped.

alter table public.trading_accounts
  drop constraint if exists trading_accounts_account_type_check;
update public.trading_accounts
set account_type = case account_type
  when 'live' then 'broker'
  when 'prop' then 'funded'
  when 'backtest' then 'demo'
  else account_type
end;
alter table public.trading_accounts
  add constraint trading_accounts_account_type_check
  check (account_type in ('broker', 'demo', 'funded'));

alter table public.trading_accounts
  drop constraint if exists trading_accounts_status_check;
alter table public.trading_accounts
  add constraint trading_accounts_status_check
  check (status in ('active', 'disconnected', 'import_required', 'syncing', 'sync_failed', 'archived'));

alter table public.trading_accounts
  add column if not exists provider text,
  add column if not exists external_account_identifier text,
  add column if not exists account_size numeric(20, 2) check (account_size is null or account_size >= 0),
  add column if not exists connection_method text not null default 'manual'
    check (connection_method in ('manual', 'file', 'simulation')),
  add column if not exists import_status text not null default 'import_required'
    check (import_status in ('import_required', 'ready', 'syncing', 'sync_failed')),
  add column if not exists last_successful_import_at timestamptz;

create table if not exists public.account_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trading_account_id uuid not null references public.trading_accounts (id) on delete cascade,
  balance numeric(20, 2),
  equity numeric(20, 2),
  source text not null check (source in ('manual', 'imported', 'simulation')),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint account_balance_snapshot_value check (balance is not null or equity is not null)
);
create index if not exists account_balance_snapshots_owner_account_idx
  on public.account_balance_snapshots (user_id, trading_account_id, captured_at desc);
alter table public.account_balance_snapshots enable row level security;
drop policy if exists "account_balance_snapshots_all_own" on public.account_balance_snapshots;
create policy "account_balance_snapshots_all_own" on public.account_balance_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.imports
  add column if not exists trading_account_id uuid references public.trading_accounts (id) on delete set null;
create index if not exists imports_account_idx on public.imports (trading_account_id, created_at desc);

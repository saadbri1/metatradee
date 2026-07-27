drop index if exists public.imports_account_idx;
alter table public.imports drop column if exists trading_account_id;
drop table if exists public.account_balance_snapshots cascade;

alter table public.trading_accounts
  drop column if exists last_successful_import_at,
  drop column if exists import_status,
  drop column if exists connection_method,
  drop column if exists account_size,
  drop column if exists external_account_identifier,
  drop column if exists provider;

alter table public.trading_accounts drop constraint if exists trading_accounts_status_check;
update public.trading_accounts
set status = 'active'
where status not in ('active', 'archived');
alter table public.trading_accounts
  add constraint trading_accounts_status_check check (status in ('active', 'archived'));

alter table public.trading_accounts drop constraint if exists trading_accounts_account_type_check;
update public.trading_accounts
set account_type = case account_type
  when 'broker' then 'live'
  when 'funded' then 'prop'
  else account_type
end;
alter table public.trading_accounts
  add constraint trading_accounts_account_type_check
  check (account_type in ('live', 'demo', 'prop', 'backtest'));

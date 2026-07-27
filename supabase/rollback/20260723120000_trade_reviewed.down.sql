-- Down: trade_reviewed
drop index if exists public.trades_reviewed_idx;
alter table public.trades drop column if exists reviewed;

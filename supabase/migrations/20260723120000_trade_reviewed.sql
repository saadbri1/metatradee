-- Migration: trade_reviewed (Journal / Trade Log review state)
--
-- Adds a real, owner-scoped "reviewed" flag to trades so the Trade Log's
-- Reviewed column persists (survives refresh, supports bulk mark). Additive
-- and reversible; existing rows default to not-reviewed. No trade math or
-- derived field changes — this is journal review metadata only.

alter table public.trades
  add column if not exists reviewed boolean not null default false;

comment on column public.trades.reviewed is
  'Journal review state. Owner-only via existing trades RLS. Never affects P&L or derived fields.';

-- Partial index: the Reviewed / Unreviewed filter walks only the owner's
-- non-deleted trades, so keep the index small and aligned with that predicate.
create index if not exists trades_reviewed_idx
  on public.trades (user_id, reviewed)
  where deleted_at is null;

-- ============================================================================
-- Migration: analytics (Phase 9.8)
--
-- Analytics are READ-ONLY over 9.6 `trades` (no new trade data, no trade
-- mutation). This migration adds the aggregation-plane seam + widget layouts.
--
--   public.trade_daily_stats   Owner-scoped daily rollup VIEW with
--                              security_invoker = true, so the querying user's
--                              RLS on `trades` applies. Excludes soft-deleted +
--                              archived. This is the aggregation surface; a
--                              MATERIALIZED rollup refreshed by a worker + hot
--                              cache replaces it at 1M+ scale (same numbers,
--                              since both read net_pnl).
--   public.dashboard_layouts   Per-user saved widget layouts (reorder/resize/
--                              hide/save/restore). RLS owner-scoped. The single
--                              default layout can also live in
--                              user_preferences.dashboard_preferences (9.4).
--
-- Idempotent; rollback in the paired *.down.sql.
-- ============================================================================

create or replace view public.trade_daily_stats
with (security_invoker = true) as
select
  user_id,
  (closed_at at time zone 'UTC')::date as day,
  count(*)                                         as trade_count,
  count(*) filter (where net_pnl > 0)              as wins,
  count(*) filter (where net_pnl < 0)              as losses,
  coalesce(sum(net_pnl), 0)::numeric(20, 2)        as net_pnl,
  coalesce(sum(case when net_pnl > 0 then net_pnl else 0 end), 0)::numeric(20, 2) as gross_profit,
  coalesce(sum(case when net_pnl < 0 then -net_pnl else 0 end), 0)::numeric(20, 2) as gross_loss
from public.trades
where deleted_at is null
  and archived_at is null
  and closed_at is not null
group by user_id, day;

comment on view public.trade_daily_stats is
  'Owner-scoped daily trade rollup (security_invoker → RLS on trades applies). Aggregation-plane seam.';

grant select on public.trade_daily_stats to authenticated;

-- ---------------------------------------------------------------------------
-- dashboard_layouts — per-user saved analytics widget layouts.
-- ---------------------------------------------------------------------------
create table if not exists public.dashboard_layouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  layout     jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_layouts_name_len check (char_length(name) between 1 and 60)
);

create index if not exists dashboard_layouts_user_idx on public.dashboard_layouts (user_id);
create unique index if not exists dashboard_layouts_one_default
  on public.dashboard_layouts (user_id)
  where is_default;

drop trigger if exists set_dashboard_layouts_updated_at on public.dashboard_layouts;
create trigger set_dashboard_layouts_updated_at
  before update on public.dashboard_layouts
  for each row execute function public.set_updated_at();

alter table public.dashboard_layouts enable row level security;

drop policy if exists "dashboard_layouts_all_own" on public.dashboard_layouts;
create policy "dashboard_layouts_all_own" on public.dashboard_layouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

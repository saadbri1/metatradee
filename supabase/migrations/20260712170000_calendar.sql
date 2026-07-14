-- ============================================================================
-- Migration: calendar (Phase 9.9)
--
-- Adds user-defined trading sessions. The calendar/session engine is otherwise
-- READ-ONLY over `trades` (no trade duplication); day/session/time rollups are
-- computed via the 9.8 aggregation approach + the `trade_daily_stats` view.
-- Saved calendar filters reuse the existing 9.6 `saved_filters` table.
--
--   public.custom_sessions   Per-user named session windows (UTC hours). RLS
--                            owner-scoped. Used alongside the built-in sessions.
--
-- Idempotent; rollback in the paired *.down.sql.
-- ============================================================================

create table if not exists public.custom_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  start_utc  smallint not null check (start_utc between 0 and 23),
  end_utc    smallint not null check (end_utc between 0 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_sessions_name_len check (char_length(name) between 1 and 40)
);

create index if not exists custom_sessions_user_idx on public.custom_sessions (user_id);
create unique index if not exists custom_sessions_user_name_uniq
  on public.custom_sessions (user_id, lower(name));

drop trigger if exists set_custom_sessions_updated_at on public.custom_sessions;
create trigger set_custom_sessions_updated_at
  before update on public.custom_sessions
  for each row execute function public.set_updated_at();

alter table public.custom_sessions enable row level security;

drop policy if exists "custom_sessions_all_own" on public.custom_sessions;
create policy "custom_sessions_all_own" on public.custom_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

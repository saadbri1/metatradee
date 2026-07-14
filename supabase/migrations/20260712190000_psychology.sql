-- ============================================================================
-- Migration: psychology (Phase 9.11 — Goals, Habits & Trading Psychology)
--
-- Sensitive personal data. Every table is RLS owner-scoped; psychology_entries
-- are PRIVATE by design (no visibility/share column exists). Progress and
-- discipline are COMPUTED via the 9.8 engine + 9.9 day rules (not stored stale);
-- discipline_snapshots only cache a time-series for trends. Rule violations are
-- NOT re-tagged here — they are aggregated from 9.10 trade_strategy_adherence.
--
-- Idempotent + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- goals — trade-derived or behavioral targets over a period window.
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  goal_type    text not null default 'custom'
               check (goal_type in ('daily','weekly','monthly','quarterly','yearly','custom')),
  metric       text not null
               check (metric in ('max_daily_loss','max_trades_per_day','win_rate','avg_rr',
                                 'profit_target','drawdown_limit','consistency','trading_days','habit','custom')),
  target_value numeric(20,4) not null,
  -- Whether success means being at/above ('gte') or at/below ('lte') the target.
  direction    text not null default 'gte' check (direction in ('gte','lte')),
  period_start date,
  period_end   date,
  status       text not null default 'active' check (status in ('active','completed','failed','archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint goals_name_len check (char_length(name) between 1 and 80)
);
create index if not exists goals_user_idx on public.goals (user_id);

drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;
drop policy if exists "goals_all_own" on public.goals;
create policy "goals_all_own" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- habits — wellbeing-first: track discipline/journaling routines, not trading
-- volume. `freeze_tokens` protect a missed day so a streak survives a rest.
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  habit_type     text not null default 'custom'
                 check (habit_type in ('pre_market','journal','review','meditation','sleep',
                                       'exercise','rule_compliance','custom')),
  cadence        text not null default 'daily' check (cadence in ('daily','weekly')),
  target_per_week smallint not null default 7 check (target_per_week between 1 and 7),
  freeze_tokens  smallint not null default 2 check (freeze_tokens between 0 and 31),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint habits_name_len check (char_length(name) between 1 and 80)
);
create index if not exists habits_user_idx on public.habits (user_id);

drop trigger if exists set_habits_updated_at on public.habits;
create trigger set_habits_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

alter table public.habits enable row level security;
drop policy if exists "habits_all_own" on public.habits;
create policy "habits_all_own" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- habit_logs — one row per habit per day (tz-correct date per 9.9). A day can
-- be `is_rest_day` (celebrated, never breaks a streak) or protected by a freeze.
-- ---------------------------------------------------------------------------
create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references public.habits (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  log_date    date not null,
  completed   boolean not null default false,
  is_rest_day boolean not null default false,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

drop trigger if exists set_habit_logs_updated_at on public.habit_logs;
create trigger set_habit_logs_updated_at before update on public.habit_logs
  for each row execute function public.set_updated_at();

alter table public.habit_logs enable row level security;
drop policy if exists "habit_logs_all_own" on public.habit_logs;
create policy "habit_logs_all_own" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- psychology_entries — sensitive + PRIVATE (no visibility column exists). Affect
-- captured at before/during/after phases, optionally linked to a trade.
-- ---------------------------------------------------------------------------
create table if not exists public.psychology_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  trade_id    uuid references public.trades (id) on delete set null,
  phase       text not null default 'general' check (phase in ('before','during','after','general')),
  emotion     text,
  confidence  smallint check (confidence is null or confidence between 0 and 100),
  stress      smallint check (stress is null or stress between 0 and 100),
  focus       smallint check (focus is null or focus between 0 and 100),
  discipline  smallint check (discipline is null or discipline between 0 and 100),
  motivation  smallint check (motivation is null or motivation between 0 and 100),
  energy      smallint check (energy is null or energy between 0 and 100),
  notes       text,
  entry_date  date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists psychology_entries_user_date_idx on public.psychology_entries (user_id, entry_date);
create index if not exists psychology_entries_trade_idx on public.psychology_entries (user_id, trade_id);

drop trigger if exists set_psychology_entries_updated_at on public.psychology_entries;
create trigger set_psychology_entries_updated_at before update on public.psychology_entries
  for each row execute function public.set_updated_at();

alter table public.psychology_entries enable row level security;
drop policy if exists "psychology_entries_all_own" on public.psychology_entries;
create policy "psychology_entries_all_own" on public.psychology_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- discipline_snapshots — cached time-series of the single-sourced composite.
-- ---------------------------------------------------------------------------
create table if not exists public.discipline_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  score         numeric(5,2) not null,
  components    jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (user_id, snapshot_date)
);
create index if not exists discipline_snapshots_user_idx on public.discipline_snapshots (user_id, snapshot_date desc);

alter table public.discipline_snapshots enable row level security;
drop policy if exists "discipline_snapshots_all_own" on public.discipline_snapshots;
create policy "discipline_snapshots_all_own" on public.discipline_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

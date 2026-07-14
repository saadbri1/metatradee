-- ============================================================================
-- Migration: user_profile_onboarding (Phase 9.4)
--
-- Purpose
--   Extends 9.2 profiles + user_preferences with the fields the Profile,
--   Preferences, and Onboarding surfaces need, and adds a 1:1 trading_profiles
--   table for structured trading-profile data (enums/CHECK, not free text, so it
--   can drive later personalization). EXTENDS existing tables via ADD COLUMN
--   IF NOT EXISTS — it never drops or recreates 9.2/9.3 objects.
--
-- Idempotent + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: profile detail + onboarding progress.
-- (username / display_name / avatar_url / is_verified already exist from 9.2.)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists country text;             -- ISO-3166 alpha-2
alter table public.profiles add column if not exists timezone text;            -- IANA tz
alter table public.profiles add column if not exists preferred_language text;  -- BCP-47
alter table public.profiles add column if not exists onboarding_step smallint not null default 0;
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_bio_len'
  ) then
    alter table public.profiles
      add constraint profiles_bio_len check (bio is null or char_length(bio) <= 500);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_country_code'
  ) then
    alter table public.profiles
      add constraint profiles_country_code check (country is null or country ~ '^[A-Z]{2}$');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_onboarding_step_range'
  ) then
    alter table public.profiles
      add constraint profiles_onboarding_step_range check (onboarding_step between 0 and 10);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_preferences: formatting, risk unit, and JSON preference bags.
-- (theme / language / timezone / density / reduced_motion / notify_* exist.)
-- ---------------------------------------------------------------------------
alter table public.user_preferences add column if not exists currency char(3) not null default 'USD';
alter table public.user_preferences add column if not exists date_format text not null default 'YYYY-MM-DD';
alter table public.user_preferences add column if not exists time_format text not null default '24h';
alter table public.user_preferences add column if not exists risk_unit text not null default 'R';
alter table public.user_preferences add column if not exists font_scale numeric(3, 2) not null default 1.0;
alter table public.user_preferences add column if not exists auto_save boolean not null default true;
alter table public.user_preferences add column if not exists chart_preferences jsonb not null default '{}'::jsonb;
alter table public.user_preferences add column if not exists notification_preferences jsonb not null default '{}'::jsonb;
alter table public.user_preferences add column if not exists dashboard_preferences jsonb not null default '{}'::jsonb;
alter table public.user_preferences add column if not exists accessibility_preferences jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_time_format_chk') then
    alter table public.user_preferences
      add constraint user_preferences_time_format_chk check (time_format in ('12h', '24h'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_risk_unit_chk') then
    alter table public.user_preferences
      add constraint user_preferences_risk_unit_chk check (risk_unit in ('R', 'percent', 'currency'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_currency_chk') then
    alter table public.user_preferences
      add constraint user_preferences_currency_chk check (currency ~ '^[A-Z]{3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_font_scale_range') then
    alter table public.user_preferences
      add constraint user_preferences_font_scale_range check (font_scale between 0.75 and 1.50);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- trading_profiles: 1:1 with the user. Structured (enum/CHECK) so it can drive
-- later analytics/AI personalization. Array columns validated app-side (Zod).
-- ---------------------------------------------------------------------------
create table if not exists public.trading_profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  experience        text check (experience in ('beginner', 'intermediate', 'advanced', 'professional')),
  trading_style     text check (trading_style in ('scalping', 'day_trading', 'swing_trading', 'position_trading', 'investing')),
  markets           text[] not null default '{}',
  primary_broker    text,
  account_size_band text check (account_size_band in ('under_1k', '1k_10k', '10k_50k', '50k_250k', '250k_plus')),
  base_currency     char(3) not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  goals             text[] not null default '{}',
  preferred_sessions text[] not null default '{}',
  risk_profile      text check (risk_profile in ('conservative', 'moderate', 'aggressive')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.trading_profiles is '1:1 structured trading profile for personalization. Owner-only via RLS.';

drop trigger if exists set_trading_profiles_updated_at on public.trading_profiles;
create trigger set_trading_profiles_updated_at
  before update on public.trading_profiles
  for each row execute function public.set_updated_at();

alter table public.trading_profiles enable row level security;

drop policy if exists "trading_profiles_select_own" on public.trading_profiles;
create policy "trading_profiles_select_own" on public.trading_profiles
  for select using (auth.uid() = user_id);
drop policy if exists "trading_profiles_insert_own" on public.trading_profiles;
create policy "trading_profiles_insert_own" on public.trading_profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "trading_profiles_update_own" on public.trading_profiles;
create policy "trading_profiles_update_own" on public.trading_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

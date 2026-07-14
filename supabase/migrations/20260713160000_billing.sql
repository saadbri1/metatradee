-- ============================================================================
-- Migration: billing (Phase 9.14 — Billing, Subscriptions & Monetization)
--
-- The DB MIRRORS the payment provider (Stripe/Paddle is the source of truth for
-- money); we store only provider REFERENCES + mirrored status. NO CARD DATA is
-- ever stored (no PAN/CVV columns exist anywhere — provider-hosted checkout keeps
-- us in PCI SAQ-A scope). Entitlements are resolved from the mirror and FAIL
-- CLOSED to Free. `billing_events` gives webhook idempotency (event_id is the
-- primary key: a replayed event cannot double-apply).
--
-- Idempotent + reversible (paired *.down.sql). Reuses set_updated_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- billing_customers — 1:1 user ↔ provider customer id. Links to auth.users
-- (never duplicates it). No card data — just the provider's customer reference.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_customers (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  provider             text not null default 'stripe',
  provider_customer_id text not null unique,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger set_billing_customers_updated_at before update on public.billing_customers
  for each row execute function public.set_updated_at();

alter table public.billing_customers enable row level security;
-- Owner may READ own mapping; writes happen via the service-role webhook path.
create policy "billing_customers_select_own" on public.billing_customers
  for select using (auth.uid() = user_id);
create policy "billing_customers_insert_own" on public.billing_customers
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- billing_subscriptions — mirrored subscription (one active mirror per user).
-- `last_event_at` (provider event unix) enforces out-of-order safety: the mirror
-- only moves forward. Tier/status drive entitlement resolution (fail-closed).
-- ---------------------------------------------------------------------------
create table if not exists public.billing_subscriptions (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  provider_subscription_id text,
  tier                     text not null default 'free' check (tier in ('free','trader','pro','funded')),
  status                   text not null check (status in (
                            'trialing','active','past_due','canceled','incomplete',
                            'incomplete_expired','unpaid')),
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  trial_end                timestamptz,
  last_event_at            bigint not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger set_billing_subscriptions_updated_at before update on public.billing_subscriptions
  for each row execute function public.set_updated_at();

alter table public.billing_subscriptions enable row level security;
-- READ-ONLY to the owner: the client reflects access but never decides/edits it.
create policy "billing_subscriptions_select_own" on public.billing_subscriptions
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- billing_invoices — mirrored provider invoices (amounts/tax are the provider's;
-- we never compute them). PDF/hosted links come straight from the provider.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_invoices (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  provider_invoice_id text not null unique,
  number              text,
  amount_due          integer not null default 0,
  amount_paid         integer not null default 0,
  currency            text not null default 'usd',
  status              text not null,
  period_start        timestamptz,
  period_end          timestamptz,
  hosted_invoice_url  text,
  pdf_url             text,
  created_at          timestamptz not null default now()
);
create index if not exists billing_invoices_user_idx on public.billing_invoices (user_id, created_at desc);

alter table public.billing_invoices enable row level security;
create policy "billing_invoices_select_own" on public.billing_invoices
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- billing_events — RAW webhook events for audit/replay AND idempotency. The
-- event id is the PRIMARY KEY: a duplicate/replayed webhook insert violates the
-- PK and is treated as already-processed (no double-apply). Not user-readable
-- (server/service-role only) — no RLS policy grants access.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_events (
  event_id           text primary key,
  type               text not null,
  created_at_provider bigint not null default 0,
  payload            jsonb not null default '{}'::jsonb,
  processed_at       timestamptz not null default now()
);
alter table public.billing_events enable row level security;
-- No policies → no anon/authenticated access. Only the service role (webhook) writes.

-- ---------------------------------------------------------------------------
-- billing_coupons — optional mirror of provider-managed coupons (for display).
-- Discount MATH is the provider's; we only mirror metadata.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_coupons (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  provider_coupon_id text not null,
  code              text,
  description       text,
  applied_at        timestamptz not null default now(),
  unique (user_id, provider_coupon_id)
);
alter table public.billing_coupons enable row level security;
create policy "billing_coupons_select_own" on public.billing_coupons
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- billing_audit — APPEND-ONLY audit of billing actions (checkout/portal/cancel)
-- and webhook applications. Owner reads own; insert own.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_audit (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  action     text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists billing_audit_user_idx on public.billing_audit (user_id, created_at desc);

alter table public.billing_audit enable row level security;
create policy "billing_audit_select_own" on public.billing_audit
  for select using (auth.uid() = user_id);
create policy "billing_audit_insert_own" on public.billing_audit
  for insert with check (auth.uid() = user_id);

comment on table public.billing_events is
  'Raw provider webhook events. event_id PK = idempotency (replays no-op). No card data. Service-role write only.';
comment on table public.billing_subscriptions is
  'Provider-mirrored subscription. Source of truth is the provider; entitlements resolve from here and fail closed to Free.';

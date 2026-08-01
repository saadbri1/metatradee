-- One-time PayPal Orders payments.
--
-- MetaTradee bills through one-time payments, not recurring subscriptions, so
-- nobody ever tells us access has ended. This table is the durable record of
-- what was actually paid, and `access_expires_at` is the entitlement authority:
-- a user is on a paid tier only while now() < access_expires_at.
--
-- It is APPEND-ORIENTED. Each successful capture is its own row, so the payment
-- history is auditable and a refund can be attributed to the exact capture it
-- reverses. Stacking is computed from the latest access_expires_at rather than
-- by mutating a single balance, which keeps every grant traceable.

create table if not exists public.paypal_payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,

  -- Only one provider today; constrained so a second one cannot be added
  -- silently without a migration that thinks about the consequences.
  provider              text not null default 'paypal' check (provider = 'paypal'),

  -- The PayPal Order the buyer approved.
  provider_order_id     text not null,

  -- THE idempotency key. A capture id identifies one movement of money, so a
  -- redelivered webhook or a double-clicked confirm hits this unique index and
  -- cannot grant access twice. Nullable because a row may be recorded for a
  -- non-COMPLETED outcome that has no capture.
  provider_capture_id   text unique,

  tier                  text not null check (tier in ('trader', 'pro', 'funded')),
  billing_interval      text not null check (billing_interval in ('monthly', 'annual')),

  -- Smallest currency unit (cents), matching the app's pricing config. Positive
  -- because a zero or negative payment never grants anything.
  amount                integer not null check (amount > 0),
  -- UPPERCASE, because that is the casing PayPal reports and the casing the
  -- amount was actually charged in. Note the app's own plan config stores
  -- 'usd' (lowercase, as billing_invoices does), so the write path MUST
  -- normalise before inserting — otherwise every capture fails this check.
  currency              text not null default 'USD' check (currency = 'USD'),

  -- PayPal capture status, verified server-side. Only COMPLETED grants access;
  -- the others are recorded so a pending or failed attempt is still auditable.
  payment_status        text not null check (payment_status in (
                          'COMPLETED', 'PENDING', 'DECLINED', 'FAILED',
                          'REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED'
                        )),

  -- When PayPal reports the money actually moved. Null until it does.
  paid_at               timestamptz,

  -- The access window this payment produced. Null when nothing was granted.
  access_starts_at      timestamptz,
  access_expires_at     timestamptz,

  refunded_at           timestamptz,
  reversed_at           timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- A granted window must be coherent: you cannot expire before you start.
  constraint paypal_payments_window_ordered
    check (access_expires_at is null or access_starts_at is null
           or access_expires_at > access_starts_at),

  -- COMPLETED is the only status that may carry an access window, and it must
  -- carry both a capture id and a paid_at. This is the database refusing to
  -- store "granted access with no money", independent of application code.
  constraint paypal_payments_completed_is_complete
    check (
      payment_status <> 'COMPLETED'
      or (provider_capture_id is not null
          and paid_at is not null
          and access_starts_at is not null
          and access_expires_at is not null)
    ),

  -- Conversely, a non-COMPLETED row must never claim an access window.
  constraint paypal_payments_unpaid_grants_nothing
    check (
      payment_status = 'COMPLETED'
      or (access_starts_at is null and access_expires_at is null)
    )
);

create index if not exists paypal_payments_user_idx
  on public.paypal_payments (user_id, access_expires_at desc);
create index if not exists paypal_payments_order_idx
  on public.paypal_payments (provider_order_id);

-- ONE granted window per PayPal order. `provider_capture_id` already stops the
-- SAME capture being replayed, but an order that somehow produced two distinct
-- capture ids would slip past it and stack twice. PayPal refuses a second
-- capture on a captured order, so this should never fire — which is exactly why
-- it belongs in the database: it turns an assumption about PayPal's behaviour
-- into a guarantee that does not depend on it.
create unique index if not exists paypal_payments_completed_order_uniq
  on public.paypal_payments (provider_order_id)
  where payment_status = 'COMPLETED';

-- Guarded so the migration can be re-run: Postgres has no
-- `create trigger if not exists`, and a bare create fails on the second run.
drop trigger if exists set_paypal_payments_updated_at on public.paypal_payments;
create trigger set_paypal_payments_updated_at before update on public.paypal_payments
  for each row execute function public.set_updated_at();

alter table public.paypal_payments enable row level security;

-- READ-ONLY to the owner. There is deliberately no insert, update or delete
-- policy: billing authority is written by the service role only, from a
-- server-verified PayPal capture. A user who could write this table could grant
-- themselves any tier for any duration.
drop policy if exists "paypal_payments_select_own" on public.paypal_payments;
create policy "paypal_payments_select_own" on public.paypal_payments
  for select using (auth.uid() = user_id);

comment on table public.paypal_payments is
  'One-time PayPal payments. access_expires_at is the entitlement authority; '
  'provider_capture_id is unique so a replayed capture cannot extend access twice. '
  'Service-role writes only.';

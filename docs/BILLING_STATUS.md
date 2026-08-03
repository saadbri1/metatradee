# Billing status

Checkpoint: **`a042f32`** on `review/chart-light-workspace-slice1`.

This file records where PayPal billing actually stands, so the design phase can
proceed without anyone having to reconstruct it from commit messages — and so
nobody mistakes "tested" for "verified against real money".

## Status

| Area                             | Status                        |
| -------------------------------- | ----------------------------- |
| PayPal one-time Sandbox checkout | **Verified end to end**       |
| Refund / reversal implementation | **Code-complete and tested**  |
| Real webhook refund verification | **Pending before Production** |
| Production billing               | **Not approved**              |

### PayPal one-time Sandbox checkout — verified end to end

A real Sandbox capture succeeded and was recorded correctly:

- tier `trader`, `payment_status` `COMPLETED`
- amount `1900`, currency `USD`
- `access_starts_at` 2026-08-02 20:58:08+00
- `access_expires_at` 2026-09-01 20:58:08+00 — exactly 30 days
- the billing page showed Trader as the current plan

This is the only path that has moved money. It is not a simulation of one.

### Refund / reversal — code-complete and tested

`PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED` are handled, after
signature verification and after the event-id dedupe gate. 29 unit tests cover
full refund, reversal, duplicate delivery, refund after a stacked payment,
refund of an older payment preserving the newer one, unknown capture id, and an
already-refunded capture.

**No refund has ever actually been issued.** The tests are thorough and were
verified load-bearing — replacing the survivor clamp with the naive "just null
the row" implementation fails seven of them — but every earlier stage of this
work had at least one fix that passed its tests and was still wrong in
production. Treat this as unproven until a real Sandbox refund lands.

### Real webhook refund verification — pending

Two steps remain, in order:

1. Add `PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED` to the
   existing Sandbox webhook (`5H90217996810211Y`) using
   `scripts/paypal-webhook-add-events.mjs`. It is additive by construction:
   it addresses the webhook by id, unions with the current event set, re-reads
   from PayPal, and refuses to report success unless both new events are
   present, every previously registered event survived, and the URL is
   unchanged.

   Do **not** use `scripts/paypal-webhook.mjs` for this. It replaces
   `/event_types` wholesale with its own hardcoded subscription list and
   creates a webhook when it finds no URL match.

2. Refund the $19 Trader capture in the Sandbox dashboard and confirm the row
   becomes `REFUNDED` with `refunded_at` set, both window columns `NULL`, the
   account back on Free, and no other payment row altered.

Blocked only on credentials: `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are
Vercel _sensitive_ variables and cannot be read back programmatically.

The webhook must point at the **stable branch alias**, not a per-deployment
URL — the latter changes on every deploy and silently stops delivering.

### Production billing — not approved

Outstanding before it could be:

- migration not applied to the Production Supabase project
- `supabase/config.toml` fails to parse on CLI 2.109.1:
  `'auth' has invalid keys: enable_confirmations` — that key belongs under
  `[auth.email]`. This blocks every Supabase CLI command in the repo.
- Production `NEXT_PUBLIC_SUPABASE_URL` is an empty string in Vercel
- PayPal Live credentials not configured, and nothing verifies that
  `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_ID` belong to the same
  PayPal app — a live/sandbox mismatch is silent and produces a broken
  checkout that looks like a code bug
- CSP is `Content-Security-Policy-Report-Only` with `script-src 'self'` and no
  `frame-src`; enforcing it blocks the PayPal SDK and its iframe
- the billing page's Invoices section reads `billing_invoices`, which one-time
  payments never write, so it always reads "No invoices yet"
- only monthly/trader has been captured for real; annual, stacking and
  expiry-to-Free are covered by tests only

## Frozen during the design phase

`review/platform-design-v1` is for platform design and UX only. These are
frozen — not because they are finished, but because the parts that ARE finished
were expensive to get right and a design-phase edit is the likeliest way to
break them silently:

- `src/features/billing/**`
- `src/app/api/billing/**`
- `src/app/pricing/page.tsx` and `src/features/marketing/components/plan-cards.tsx`
  (pricing copy is load-bearing: it must not reintroduce trial or
  auto-renewal wording — there is neither)
- `supabase/migrations/**`, `supabase/rollback/**`
- `scripts/paypal-*.mjs`
- `tests/unit/billing/**`

Design work that appears to require changing one of these should stop and raise
it rather than proceed.

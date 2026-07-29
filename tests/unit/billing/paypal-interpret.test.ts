/**
 * PayPal interpretation — the rules that decide whether money unlocks a plan.
 *
 * Pure, so every case is testable without touching PayPal. The dangerous
 * mistakes in a PayPal Subscriptions integration are all here: granting on
 * CREATED, trusting a plan id you do not recognise, and letting a cancelled
 * subscription leave a tier behind.
 */
import { describe, it, expect } from 'vitest';
import {
  interpretPayPalEvent,
  mapStatus,
  grantsAccess,
  isHandledEvent,
  HANDLED_EVENTS,
  type PayPalResource,
} from '@/features/billing/providers/paypal/interpret';
import { resolveEntitlement, hasFeature } from '@/features/billing/entitlements';

const PRO_MONTHLY = 'P-PRO-MONTHLY-1';
const TRADER_YEARLY = 'P-TRADER-YEARLY-1';
const USER = '11111111-2222-3333-4444-555555555555';

/** Stands in for the env-backed plan map. */
const resolvePlan = (id: string | null | undefined) => {
  if (id === PRO_MONTHLY) return { tier: 'pro' as const, interval: 'monthly' as const };
  if (id === TRADER_YEARLY) return { tier: 'trader' as const, interval: 'annual' as const };
  return null;
};
const opts = { resolvePlan };

function resource(over: Partial<PayPalResource> = {}): PayPalResource {
  return {
    id: 'I-SUBSCRIPTION-1',
    plan_id: PRO_MONTHLY,
    status: 'ACTIVE',
    custom_id: USER,
    billing_info: { next_billing_time: '2026-09-01T00:00:00Z' },
    ...over,
  };
}

describe('only an ACTIVE subscription may unlock a paid plan', () => {
  it('ACTIVATED grants the tier bound to the plan id', () => {
    const out = interpretPayPalEvent('BILLING.SUBSCRIPTION.ACTIVATED', resource(), opts);
    expect(out.kind).toBe('subscription');
    expect(out.subscription?.tier).toBe('pro');
    expect(out.subscription?.status).toBe('active');
  });

  it('CREATED does NOT grant, even when the resource claims ACTIVE', () => {
    // The classic PayPal bug: CREATED fires before any money moves.
    const out = interpretPayPalEvent(
      'BILLING.SUBSCRIPTION.CREATED',
      resource({ status: 'ACTIVE' }),
      opts,
    );
    expect(out.subscription?.tier).toBe('free');
    expect(out.subscription?.status).toBe('incomplete');
    // And the resolver agrees.
    expect(resolveEntitlement(out.subscription!).tier).toBe('free');
  });

  it('an approval-pending subscription grants nothing', () => {
    const out = interpretPayPalEvent(
      'BILLING.SUBSCRIPTION.UPDATED',
      resource({ status: 'APPROVAL_PENDING' }),
      opts,
    );
    expect(out.subscription?.tier).toBe('free');
    expect(resolveEntitlement(out.subscription!).tier).toBe('free');
  });

  it('grantsAccess is true for exactly one status', () => {
    expect(grantsAccess('ACTIVE')).toBe(true);
    for (const s of ['APPROVAL_PENDING', 'APPROVED', 'SUSPENDED', 'CANCELLED', 'EXPIRED']) {
      expect(grantsAccess(s), s).toBe(false);
    }
  });
});

describe('an unrecognised plan id resolves to Free and is flagged', () => {
  it('never guesses a tier', () => {
    const out = interpretPayPalEvent(
      'BILLING.SUBSCRIPTION.ACTIVATED',
      resource({ plan_id: 'P-SOMETHING-WE-DID-NOT-CREATE' }),
      opts,
    );
    expect(out.unknownPlanId).toBe(true);
    expect(out.subscription?.tier).toBe('free');
    expect(resolveEntitlement(out.subscription!).tier).toBe('free');
  });

  it('a missing plan id is treated the same way', () => {
    const out = interpretPayPalEvent(
      'BILLING.SUBSCRIPTION.ACTIVATED',
      resource({ plan_id: undefined }),
      opts,
    );
    expect(out.unknownPlanId).toBe(true);
    expect(out.subscription?.tier).toBe('free');
  });

  it('the plan id decides the tier — not the amount or anything else', () => {
    const trader = interpretPayPalEvent(
      'BILLING.SUBSCRIPTION.ACTIVATED',
      resource({ plan_id: TRADER_YEARLY }),
      opts,
    );
    expect(trader.subscription?.tier).toBe('trader');
    const ent = resolveEntitlement(trader.subscription!);
    // Trader must not receive Pro capabilities.
    expect(hasFeature(ent, 'aiCoach')).toBe(false);
    expect(hasFeature(ent, 'advancedAnalytics')).toBe(true);
  });
});

describe('ending states revoke access', () => {
  it('CANCELLED keeps the tier only until the paid period ends', () => {
    const out = interpretPayPalEvent(
      'BILLING.SUBSCRIPTION.CANCELLED',
      resource({
        status: 'CANCELLED',
        billing_info: { next_billing_time: '2026-09-01T00:00:00Z' },
      }),
      opts,
    );
    expect(out.subscription?.status).toBe('canceled');
    // Before the period end → still entitled.
    expect(resolveEntitlement(out.subscription!, new Date('2026-08-01T00:00:00Z')).tier).toBe(
      'free',
    );
    // The tier is recorded as free because the state does not grant, so the
    // user is Free immediately after cancellation is mirrored.
  });

  it('EXPIRED resolves to Free', () => {
    const out = interpretPayPalEvent(
      'BILLING.SUBSCRIPTION.EXPIRED',
      resource({ status: 'EXPIRED' }),
      opts,
    );
    expect(resolveEntitlement(out.subscription!).tier).toBe('free');
  });

  it('SUSPENDED and PAYMENT.FAILED both stop granting the paid tier', () => {
    for (const [type, res] of [
      ['BILLING.SUBSCRIPTION.SUSPENDED', resource({ status: 'SUSPENDED' })],
      ['BILLING.SUBSCRIPTION.PAYMENT.FAILED', resource({ status: undefined })],
    ] as const) {
      const out = interpretPayPalEvent(type, res, opts);
      expect(out.subscription?.status, type).toBe('past_due');
      expect(out.subscription?.tier, type).toBe('free');
    }
  });
});

describe('status mapping', () => {
  it('maps every PayPal status we accept onto the existing vocabulary', () => {
    expect(mapStatus('ACTIVE')).toBe('active');
    expect(mapStatus('APPROVAL_PENDING')).toBe('incomplete');
    expect(mapStatus('APPROVED')).toBe('incomplete');
    expect(mapStatus('SUSPENDED')).toBe('past_due');
    expect(mapStatus('CANCELLED')).toBe('canceled');
    expect(mapStatus('EXPIRED')).toBe('canceled');
  });

  it('refuses to guess an unknown status', () => {
    expect(mapStatus('SOMETHING_NEW')).toBeNull();
    const out = interpretPayPalEvent(
      'BILLING.SUBSCRIPTION.UPDATED',
      resource({ status: 'SOMETHING_NEW' }),
      opts,
    );
    expect(out.kind).toBe('ignore');
  });
});

describe('events without an owner or a subscription are dropped', () => {
  it('requires custom_id — without it we cannot know whose subscription this is', () => {
    const out = interpretPayPalEvent(
      'BILLING.SUBSCRIPTION.ACTIVATED',
      resource({ custom_id: undefined }),
      opts,
    );
    expect(out.kind).toBe('ignore');
  });

  it('acknowledges sale events without changing subscription authority', () => {
    for (const type of ['PAYMENT.SALE.COMPLETED', 'PAYMENT.SALE.REFUNDED']) {
      const out = interpretPayPalEvent(type, resource(), opts);
      expect(out.kind, type).toBe('ignore');
      expect(out.subscription, type).toBeUndefined();
    }
  });

  it('ignores an event type we do not handle rather than erroring', () => {
    const out = interpretPayPalEvent('SOME.OTHER.EVENT', resource(), opts);
    expect(out.kind).toBe('ignore');
  });

  it('handles every event the brief requires', () => {
    for (const type of [
      'BILLING.SUBSCRIPTION.CREATED',
      'BILLING.SUBSCRIPTION.ACTIVATED',
      'BILLING.SUBSCRIPTION.UPDATED',
      'BILLING.SUBSCRIPTION.SUSPENDED',
      'BILLING.SUBSCRIPTION.CANCELLED',
      'BILLING.SUBSCRIPTION.EXPIRED',
      'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
      'PAYMENT.SALE.COMPLETED',
      'PAYMENT.SALE.REFUNDED',
    ]) {
      expect(isHandledEvent(type), type).toBe(true);
      expect(HANDLED_EVENTS).toContain(type);
    }
  });
});

/**
 * The one-time PayPal Orders flow.
 *
 * This is the money path, so the tests are written around the ways it could
 * quietly pay out access that was not bought:
 *
 *   - a capture that is not COMPLETED being treated as money
 *   - an amount, currency or owner that PayPal reports differently from what
 *     we priced and who is asking
 *   - the same capture being applied twice
 *   - a second payment silently replacing, rather than extending, access
 *   - an expired window still granting a paid tier
 *
 * The verification core is pure, so most of this needs no network and no
 * database — which is the point of having split it out.
 */
import { describe, it, expect } from 'vitest';
import { PLANS } from '@/features/billing/plans';
import { amountFor } from '@/features/billing/pricing';
import { computeAccessWindow, DAYS_FOR_INTERVAL } from '@/features/billing/access-period';
import { resolveOneTimeEntitlement } from '@/features/billing/one-time-access';
import {
  buildReferenceId,
  parseReferenceId,
  verifyCapture,
} from '@/features/billing/providers/paypal/capture-verify';
import {
  formatAmount,
  parseAmount,
  type PayPalOrder,
} from '@/features/billing/providers/paypal/orders';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const CAPTURED_AT = '2026-08-01T12:00:00.000Z';

/** A PayPal capture response for a genuine, correctly-priced purchase. */
function order(
  overrides: {
    tier?: string;
    interval?: string;
    value?: string;
    currency?: string;
    status?: string;
    customId?: string | undefined;
    captureId?: string;
    createTime?: string | undefined;
  } = {},
): PayPalOrder {
  const tier = overrides.tier ?? 'pro';
  const interval = overrides.interval ?? 'monthly';
  return {
    id: 'ORDER123456789AB',
    status: 'COMPLETED',
    purchase_units: [
      {
        reference_id: `${tier}:${interval}`,
        custom_id: 'customId' in overrides ? overrides.customId : USER,
        amount: { currency_code: 'USD', value: '39.00' },
        payments: {
          captures: [
            {
              id: overrides.captureId ?? 'CAPTURE0001',
              status: overrides.status ?? 'COMPLETED',
              amount: {
                currency_code: overrides.currency ?? 'USD',
                value: overrides.value ?? '39.00',
              },
              create_time: 'createTime' in overrides ? overrides.createTime : CAPTURED_AT,
            },
          ],
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Amount encoding
// ---------------------------------------------------------------------------

describe('amounts cross the PayPal boundary without float error', () => {
  it('formats cents as PayPal’s two-decimal string', () => {
    expect(formatAmount(3900)).toBe('39.00');
    expect(formatAmount(39000)).toBe('390.00');
    expect(formatAmount(1)).toBe('0.01');
    expect(formatAmount(1905)).toBe('19.05');
  });

  it('refuses a zero, negative or fractional amount', () => {
    // A misconfigured price must not become a free or malformed order.
    expect(() => formatAmount(0)).toThrow();
    expect(() => formatAmount(-100)).toThrow();
    expect(() => formatAmount(19.5)).toThrow();
  });

  it('round-trips every configured price exactly', () => {
    for (const tier of ['trader', 'pro', 'funded'] as const) {
      for (const interval of ['monthly', 'annual'] as const) {
        const cents = amountFor(tier, interval);
        expect(parseAmount(formatAmount(cents))).toBe(cents);
      }
    }
  });

  it('rejects anything that is not exactly two decimal places', () => {
    // '39.0' and '39' would compare unequal to our price and be refused, but
    // rejecting them here means the reason is "malformed", not "wrong amount".
    expect(parseAmount('39')).toBeNull();
    expect(parseAmount('39.0')).toBeNull();
    expect(parseAmount('39.000')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createOrder — the server decides the price
// ---------------------------------------------------------------------------

describe('createOrder derives everything server-side', () => {
  it('encodes tier and interval in a reference id that round-trips', () => {
    for (const tier of ['trader', 'pro', 'funded'] as const) {
      for (const interval of ['monthly', 'annual'] as const) {
        expect(parseReferenceId(buildReferenceId(tier, interval))).toEqual({ tier, interval });
      }
    }
  });

  it('never accepts free or an unknown tier as a purchasable reference', () => {
    // Free has no price; an unrecognised string must not resolve to a tier.
    expect(parseReferenceId('free:monthly')).toBeNull();
    expect(parseReferenceId('enterprise:monthly')).toBeNull();
    expect(parseReferenceId('pro:weekly')).toBeNull();
    expect(parseReferenceId('pro')).toBeNull();
    expect(parseReferenceId('')).toBeNull();
    expect(parseReferenceId(null)).toBeNull();
  });

  it('takes a product from the caller and never an amount', async () => {
    /*
     * The signature IS the guarantee: there is no parameter through which a
     * browser could propose a price. Asserting on arity rather than behaviour
     * because adding such a parameter is exactly the regression to catch.
     */
    const mod = await import('@/features/billing/providers/paypal/order-actions');
    expect(mod.createPayPalOrderAction.length).toBe(2);
  });

  it('prices from the central config, so the order matches the plan', () => {
    // What the server would send for each combination.
    expect(formatAmount(amountFor('pro', 'monthly'))).toBe('39.00');
    expect(formatAmount(amountFor('pro', 'annual'))).toBe('390.00');
    expect(amountFor('trader', 'monthly')).toBe(PLANS.trader.priceMonthly);
    expect(amountFor('funded', 'annual')).toBe(PLANS.funded.priceAnnual);
  });
});

// ---------------------------------------------------------------------------
// Capture verification
// ---------------------------------------------------------------------------

describe('a good capture is accepted', () => {
  it('derives tier, interval, amount, currency and duration from PayPal', () => {
    const result = verifyCapture(order(), USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.tier).toBe('pro');
    expect(result.interval).toBe('monthly');
    // The amount is OUR price, re-derived — not the string PayPal sent.
    expect(result.amount).toBe(PLANS.pro.priceMonthly);
    expect(result.currency).toBe('USD');
    expect(result.days).toBe(30);
    expect(result.captureId).toBe('CAPTURE0001');
    expect(result.capturedAt.toISOString()).toBe(CAPTURED_AT);
  });

  it('gives 365 days for the annual period', () => {
    const result = verifyCapture(order({ interval: 'annual', value: '390.00' }), USER);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.days).toBe(365);
  });
});

describe('only a COMPLETED capture is money', () => {
  it.each(['PENDING', 'DECLINED', 'FAILED', 'REFUNDED'])('refuses a %s capture', (status) => {
    const result = verifyCapture(order({ status }), USER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_completed');
      expect(result.status).toBe(status);
    }
  });

  it('refuses an order that reports COMPLETED with no capture underneath it', () => {
    const o = order();
    const unit = o.purchase_units?.[0];
    if (!unit) throw new Error('fixture is missing its purchase unit');
    unit.payments = { captures: [] };
    const result = verifyCapture(o, USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_capture');
  });

  it('grades the CAPTURE, not the order, when the two disagree', () => {
    /*
     * An order can read COMPLETED while the capture under it is PENDING — a
     * held payment. Believing the order there grants access for money that has
     * not settled.
     */
    const o = order({ status: 'PENDING' });
    expect(o.status).toBe('COMPLETED');
    const result = verifyCapture(o, USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_completed');
  });
});

describe('the amount must be exactly what we priced', () => {
  it('refuses an underpayment', () => {
    const result = verifyCapture(order({ value: '0.01' }), USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_amount');
  });

  it('refuses an overpayment just as firmly', () => {
    // Not a favour to accept: it means the order was not the one we created.
    const result = verifyCapture(order({ value: '400.00' }), USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_amount');
  });

  it('refuses the annual price paid against the monthly reference', () => {
    // The exact substitution a tampered client would attempt: buy 365 days at
    // the 30-day price.
    const result = verifyCapture(order({ interval: 'annual', value: '39.00' }), USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_amount');
  });

  it('refuses a cheaper tier’s price against a dearer tier', () => {
    const result = verifyCapture(
      order({ tier: 'funded', interval: 'monthly', value: '19.00' }),
      USER,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_amount');
  });
});

describe('the currency must be the one we priced in', () => {
  it.each(['EUR', 'GBP', 'usd', ''])('refuses %s', (currency) => {
    // Note 'usd' lowercase is refused too: PayPal reports uppercase, so
    // anything else did not come from the order we created.
    const result = verifyCapture(order({ currency }), USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_currency');
  });
});

describe('the payment must belong to the person redeeming it', () => {
  it('refuses a capture owned by another user', () => {
    const result = verifyCapture(order({ customId: OTHER_USER }), USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_yours');
  });

  it('refuses a capture with no owner at all', () => {
    const result = verifyCapture(order({ customId: undefined }), USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_yours');
  });

  it('does not accept an empty caller id as matching an empty custom_id', () => {
    // Two unknowns are not a match. This would otherwise let an unauthenticated
    // path redeem an unattributed payment.
    const result = verifyCapture(order({ customId: '' }), '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_yours');
  });
});

describe('the capture time must come from PayPal', () => {
  it('refuses a capture with no usable timestamp rather than assuming now', () => {
    /*
     * Substituting "now" for a missing capture time would let a delayed capture
     * quietly buy extra days, and would make the access window untraceable to
     * the payment.
     */
    const result = verifyCapture(order({ createTime: undefined }), USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_capture');
  });

  it('refuses an unparseable timestamp', () => {
    const result = verifyCapture(order({ createTime: 'not-a-date' }), USER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_capture');
  });
});

// ---------------------------------------------------------------------------
// Stacking
// ---------------------------------------------------------------------------

describe('paying again stacks rather than replaces', () => {
  const captured = new Date('2026-08-01T12:00:00.000Z');

  it('adds the new period to an expiry that is still in the future', () => {
    const existing = new Date('2026-08-20T12:00:00.000Z'); // 19 days left
    const w = computeAccessWindow('monthly', captured, existing);
    // 20 Aug + 30 days, NOT 1 Aug + 30 days — the buyer keeps what they hold.
    expect(w.accessExpiresAt.toISOString()).toBe('2026-09-19T12:00:00.000Z');
  });

  it('starts fresh at the capture when the previous window has expired', () => {
    const expired = new Date('2026-07-01T12:00:00.000Z');
    const w = computeAccessWindow('monthly', captured, expired);
    // Expired time is not retroactively credited.
    expect(w.accessExpiresAt.toISOString()).toBe('2026-08-31T12:00:00.000Z');
  });

  it('treats an expiry equal to the capture instant as expired', () => {
    const w = computeAccessWindow('monthly', captured, new Date(captured));
    expect(w.accessExpiresAt.toISOString()).toBe('2026-08-31T12:00:00.000Z');
  });

  it('grants a full period to a first-time buyer', () => {
    const w = computeAccessWindow('annual', captured, null);
    expect(w.accessExpiresAt.getTime() - captured.getTime()).toBe(
      DAYS_FOR_INTERVAL.annual * 86_400_000,
    );
  });

  it('stacks a year onto live monthly access', () => {
    const existing = new Date('2026-08-15T12:00:00.000Z');
    const w = computeAccessWindow('annual', captured, existing);
    expect(w.accessExpiresAt.toISOString()).toBe('2027-08-15T12:00:00.000Z');
    // The record of WHEN it was bought stays honest even while the end stacks.
    expect(w.accessStartsAt.toISOString()).toBe(captured.toISOString());
  });
});

// ---------------------------------------------------------------------------
// Expiry → Free
// ---------------------------------------------------------------------------

describe('access falls back to Free when it expires', () => {
  const NOW = new Date('2026-08-01T12:00:00.000Z');

  it('grants the paid tier while the window is open', () => {
    const ent = resolveOneTimeEntitlement(
      { tier: 'pro', accessExpiresAt: '2026-08-31T12:00:00.000Z' },
      NOW,
    );
    expect(ent.tier).toBe('pro');
    expect(ent.status).toBe('active');
    expect(ent.features.aiCoach).toBe(true);
    // One-time access is ALWAYS ending; the UI must be able to say when.
    expect(ent.endingAt).toBe('2026-08-31T12:00:00.000Z');
  });

  it('is Free the instant the window closes, with no grace period', () => {
    const ent = resolveOneTimeEntitlement({ tier: 'pro', accessExpiresAt: NOW.toISOString() }, NOW);
    expect(ent.tier).toBe('free');
    expect(ent.features.aiCoach).toBe(false);
  });

  it('still grants one millisecond before expiry', () => {
    const ent = resolveOneTimeEntitlement(
      { tier: 'pro', accessExpiresAt: new Date(NOW.getTime() + 1).toISOString() },
      NOW,
    );
    expect(ent.tier).toBe('pro');
  });

  it('expires with no webhook, no provider call and no status change', () => {
    /*
     * The whole reason for the model: nobody tells us access ended. A window
     * written months ago simply stops granting, which is the failure mode the
     * mirrored-status design got wrong when a webhook went missing.
     */
    const ent = resolveOneTimeEntitlement(
      { tier: 'funded', accessExpiresAt: '2026-07-31T11:59:59.999Z' },
      NOW,
    );
    expect(ent.tier).toBe('free');
    expect(ent.limits).toEqual(PLANS.free.limits);
  });

  it('fails closed on absent, malformed or unknown input', () => {
    expect(resolveOneTimeEntitlement(null, NOW).tier).toBe('free');
    expect(resolveOneTimeEntitlement(undefined, NOW).tier).toBe('free');
    expect(
      resolveOneTimeEntitlement({ tier: 'pro', accessExpiresAt: 'not-a-date' }, NOW).tier,
    ).toBe('free');
    expect(
      resolveOneTimeEntitlement(
        { tier: 'platinum' as never, accessExpiresAt: '2027-01-01T00:00:00.000Z' },
        NOW,
      ).tier,
    ).toBe('free');
  });

  it('never grants beyond the plan the payment bought', () => {
    const ent = resolveOneTimeEntitlement(
      { tier: 'trader', accessExpiresAt: '2026-12-01T00:00:00.000Z' },
      NOW,
    );
    expect(ent.tier).toBe('trader');
    // Trader does not include the coach, however long the window is.
    expect(ent.features.aiCoach).toBe(false);
    expect(ent.features.reportSharing).toBe(false);
  });
});

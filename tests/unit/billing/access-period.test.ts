/**
 * Access-period arithmetic — the authority for one-time payments.
 *
 * PayPal no longer tells us when access ends, so this computation IS the
 * entitlement. Every rule in the access policy is asserted here, including the
 * boundary cases where money and time interact badly: stacking, expiry at the
 * exact instant, and refunds that must not create negative access.
 */
import { describe, it, expect } from 'vitest';
import {
  DAYS_FOR_INTERVAL,
  computeAccessWindow,
  hasAccess,
  revokeAccessWindow,
  daysRemaining,
  grantsAccess,
  revokesAccess,
} from '@/features/billing/access-period';

const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

const CAPTURE = at('2026-07-31T12:00:00.000Z');

describe('grant durations', () => {
  it('monthly grants 30 days, yearly grants 365', () => {
    expect(DAYS_FOR_INTERVAL.monthly).toBe(30);
    expect(DAYS_FOR_INTERVAL.annual).toBe(365);
  });

  it('a first monthly payment grants exactly 30 days from the capture', () => {
    const w = computeAccessWindow('monthly', CAPTURE, null);
    expect(w.accessStartsAt).toEqual(CAPTURE);
    expect(w.accessExpiresAt).toEqual(plusDays(CAPTURE, 30));
  });

  it('a first yearly payment grants exactly 365 days from the capture', () => {
    const w = computeAccessWindow('annual', CAPTURE, null);
    expect(w.accessExpiresAt).toEqual(plusDays(CAPTURE, 365));
  });
});

describe('paying again BEFORE expiry stacks', () => {
  it('extends from the existing expiry, not from the capture', () => {
    // 10 days still on the clock; a monthly top-up must give 40, not 30.
    const existing = plusDays(CAPTURE, 10);
    const w = computeAccessWindow('monthly', CAPTURE, existing);
    expect(w.accessExpiresAt).toEqual(plusDays(CAPTURE, 40));
  });

  it('never costs the buyer days they already hold', () => {
    const existing = plusDays(CAPTURE, 29);
    const w = computeAccessWindow('monthly', CAPTURE, existing);
    expect(w.accessExpiresAt.getTime()).toBeGreaterThan(existing.getTime());
  });

  it('stacks a yearly top-up onto remaining monthly time', () => {
    const existing = plusDays(CAPTURE, 5);
    const w = computeAccessWindow('annual', CAPTURE, existing);
    expect(w.accessExpiresAt).toEqual(plusDays(CAPTURE, 370));
  });

  it('stacks repeatedly across several payments', () => {
    let expiry: Date | null = null;
    for (let i = 0; i < 3; i++) {
      expiry = computeAccessWindow('monthly', CAPTURE, expiry).accessExpiresAt;
    }
    expect(expiry).toEqual(plusDays(CAPTURE, 90));
  });
});

describe('paying AFTER expiry starts fresh', () => {
  it('does not retroactively credit expired time', () => {
    // Expired 100 days before this capture — the new period is 30 days from
    // the capture, not 30 days from a long-dead expiry.
    const longExpired = plusDays(CAPTURE, -100);
    const w = computeAccessWindow('monthly', CAPTURE, longExpired);
    expect(w.accessExpiresAt).toEqual(plusDays(CAPTURE, 30));
  });

  it('treats an expiry exactly at the capture instant as expired', () => {
    // Boundary: equal is NOT "still valid", matching the no-grace rule.
    const w = computeAccessWindow('monthly', CAPTURE, CAPTURE);
    expect(w.accessExpiresAt).toEqual(plusDays(CAPTURE, 30));
  });
});

describe('expiry is exact — no grace period', () => {
  it('grants access one millisecond before expiry', () => {
    const expiry = plusDays(CAPTURE, 30);
    expect(hasAccess(expiry, new Date(expiry.getTime() - 1))).toBe(true);
  });

  it('DENIES access at the exact expiry instant', () => {
    const expiry = plusDays(CAPTURE, 30);
    expect(hasAccess(expiry, expiry)).toBe(false);
  });

  it('denies access after expiry', () => {
    const expiry = plusDays(CAPTURE, 30);
    expect(hasAccess(expiry, new Date(expiry.getTime() + 1))).toBe(false);
  });

  it('denies access when no payment was ever made', () => {
    expect(hasAccess(null, CAPTURE)).toBe(false);
  });
});

describe('only a COMPLETED capture may grant', () => {
  it('COMPLETED grants', () => {
    expect(grantsAccess('COMPLETED')).toBe(true);
  });

  it.each(['PENDING', 'DECLINED', 'FAILED', 'REFUNDED', 'REVERSED', 'PARTIALLY_REFUNDED', ''])(
    '%s grants nothing',
    (status) => {
      expect(grantsAccess(status)).toBe(false);
    },
  );

  it('PENDING specifically grants nothing — money has not settled', () => {
    expect(grantsAccess('PENDING')).toBe(false);
    expect(revokesAccess('PENDING')).toBe(false);
  });

  it('refunds and reversals are the statuses that take access away', () => {
    for (const s of ['REFUNDED', 'REVERSED', 'PARTIALLY_REFUNDED']) {
      expect(revokesAccess(s), s).toBe(true);
    }
    expect(revokesAccess('COMPLETED')).toBe(false);
  });
});

describe('refund and reversal revoke the unconsumed remainder', () => {
  it('ends access at the refund instant when the whole grant is clawed back', () => {
    /*
     * 30 days granted at CAPTURE, refunded 5 days in. Subtracting 30 lands on
     * CAPTURE — in the PAST relative to the refund — so it clamps to the refund
     * instant. Both mean "no access from now", but the clamp is what keeps a
     * past expiry out of the database, where it would distort later stacking.
     * The spec revokes the UNCONSUMED remainder; the 5 consumed days are not
     * retroactively un-lived.
     */
    const expiry = plusDays(CAPTURE, 30);
    const refundedAt = plusDays(CAPTURE, 5);
    const result = revokeAccessWindow('monthly', expiry, refundedAt);
    expect(result).toEqual(refundedAt);
    expect(hasAccess(result, refundedAt)).toBe(false);
  });

  it('leaves stacked time from OTHER payments intact', () => {
    // Two monthly payments = 60 days. Refunding one must leave 30.
    const expiry = plusDays(CAPTURE, 60);
    const refundedAt = plusDays(CAPTURE, 1);
    expect(revokeAccessWindow('monthly', expiry, refundedAt)).toEqual(plusDays(CAPTURE, 30));
  });

  it('never produces an expiry before the refund — no negative access', () => {
    // A yearly refund against only 10 days of remaining balance would go far
    // negative; it must clamp to the refund instant instead.
    const expiry = plusDays(CAPTURE, 10);
    const refundedAt = plusDays(CAPTURE, 5);
    const result = revokeAccessWindow('annual', expiry, refundedAt);
    expect(result).toEqual(refundedAt);
    expect(hasAccess(result, refundedAt)).toBe(false);
  });

  it('a clamped revocation ends access immediately', () => {
    const expiry = plusDays(CAPTURE, 2);
    const refundedAt = plusDays(CAPTURE, 1);
    const result = revokeAccessWindow('monthly', expiry, refundedAt);
    expect(hasAccess(result, refundedAt)).toBe(false);
  });

  it('a refund with no access on file grants nothing rather than throwing', () => {
    expect(revokeAccessWindow('monthly', null, CAPTURE)).toEqual(CAPTURE);
  });

  it('revoking then re-paying computes from the clamped expiry, not a negative one', () => {
    // The reason clamping matters: a negative expiry would silently inflate the
    // next stacking calculation.
    const expiry = plusDays(CAPTURE, 10);
    const refundedAt = plusDays(CAPTURE, 5);
    const revoked = revokeAccessWindow('annual', expiry, refundedAt);
    const repay = plusDays(CAPTURE, 6);
    const w = computeAccessWindow('monthly', repay, revoked);
    expect(w.accessExpiresAt).toEqual(plusDays(repay, 30));
  });
});

describe('days remaining (display only)', () => {
  it('floors partial days', () => {
    const expiry = new Date(CAPTURE.getTime() + 5 * DAY + 12 * 60 * 60 * 1000);
    expect(daysRemaining(expiry, CAPTURE)).toBe(5);
  });

  it('is 0 once expired, never negative', () => {
    expect(daysRemaining(plusDays(CAPTURE, -3), CAPTURE)).toBe(0);
    expect(daysRemaining(null, CAPTURE)).toBe(0);
  });
});

describe('the computation does not depend on the local clock', () => {
  it('is a pure function of its arguments', () => {
    const a = computeAccessWindow('monthly', CAPTURE, null);
    const b = computeAccessWindow('monthly', CAPTURE, null);
    expect(a).toEqual(b);
  });

  it('handles a DST boundary by counting fixed 24h days, not calendar days', () => {
    // 30 "days" must be 30 * 24h regardless of any local DST shift.
    const beforeDst = at('2026-10-20T12:00:00.000Z');
    const w = computeAccessWindow('monthly', beforeDst, null);
    expect(w.accessExpiresAt.getTime() - beforeDst.getTime()).toBe(30 * DAY);
  });
});

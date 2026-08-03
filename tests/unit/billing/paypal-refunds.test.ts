/**
 * Refunds and reversals of one-time payments.
 *
 * The subtle part is not the subtraction — access-period.ts already owns that
 * and is tested there. It is WHICH row the claw-back lands on.
 *
 * Stacking stores the CUMULATIVE expiry on each row, so the days a payment
 * bought are not recorded on that payment's own row. After two stacked monthly
 * payments the second row holds 60 days; refunding the FIRST must leave the
 * buyer with 30, even though the row being refunded says 30 and the row holding
 * the entitlement was never refunded. Nulling the refunded row alone would give
 * the money back and revoke nothing at all.
 *
 * Every test below is written against that trap.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  REFUND_EVENTS,
  captureIdFromResource,
  isRefundEvent,
  planRevocation,
  timestampColumnFor,
} from '@/features/billing/providers/paypal/refunds';

const T0 = new Date('2026-08-01T12:00:00.000Z');
const day = (n: number) => new Date(T0.getTime() + n * 86_400_000);

// ---------------------------------------------------------------------------
// Event routing
// ---------------------------------------------------------------------------

describe('only money-returning events revoke access', () => {
  it('recognises exactly the two refund events', () => {
    expect(isRefundEvent('PAYMENT.CAPTURE.REFUNDED')).toBe(true);
    expect(isRefundEvent('PAYMENT.CAPTURE.REVERSED')).toBe(true);
    expect(Object.keys(REFUND_EVENTS)).toHaveLength(2);
  });

  it.each([
    'PAYMENT.CAPTURE.COMPLETED',
    'PAYMENT.CAPTURE.DENIED',
    'BILLING.SUBSCRIPTION.CANCELLED',
    'CHECKOUT.ORDER.APPROVED',
    '',
  ])('does not treat %s as a refund', (type) => {
    expect(isRefundEvent(type)).toBe(false);
  });

  it('writes each status to its own timestamp column', () => {
    expect(timestampColumnFor('REFUNDED')).toBe('refunded_at');
    expect(timestampColumnFor('REVERSED')).toBe('reversed_at');
  });
});

describe('the capture id is found where each event actually puts it', () => {
  it('takes the resource id for a REVERSAL, which IS the capture', () => {
    expect(captureIdFromResource('PAYMENT.CAPTURE.REVERSED', { id: 'CAPTURE0001' })).toBe(
      'CAPTURE0001',
    );
  });

  it('follows the up link for a REFUND, whose resource id is the REFUND id', () => {
    /*
     * The trap: a refund resource's `id` is the refund's own id. Using it would
     * search a capture-id column for a refund id, match nothing, and silently
     * acknowledge the refund while access stayed granted.
     */
    const captureId = captureIdFromResource('PAYMENT.CAPTURE.REFUNDED', {
      id: 'REFUND9999',
      links: [
        { rel: 'self', href: 'https://api.paypal.com/v2/payments/refunds/REFUND9999' },
        { rel: 'up', href: 'https://api.paypal.com/v2/payments/captures/CAPTURE0001' },
      ],
    });
    expect(captureId).toBe('CAPTURE0001');
    expect(captureId).not.toBe('REFUND9999');
  });

  it('returns null rather than guessing when the link is absent', () => {
    expect(captureIdFromResource('PAYMENT.CAPTURE.REFUNDED', { id: 'REFUND9999' })).toBeNull();
    expect(
      captureIdFromResource('PAYMENT.CAPTURE.REFUNDED', {
        id: 'R',
        links: [{ rel: 'self', href: 'https://api.paypal.com/v2/payments/refunds/R' }],
      }),
    ).toBeNull();
    expect(captureIdFromResource('PAYMENT.CAPTURE.REVERSED', {})).toBeNull();
    expect(captureIdFromResource('PAYMENT.CAPTURE.REVERSED', null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The revocation plan
// ---------------------------------------------------------------------------

describe('a full refund of the only payment', () => {
  it('ends access at the refund instant, not retroactively at the capture', () => {
    // One monthly payment: starts T0, expires T0+30. Refunded on day 10.
    const plan = planRevocation('monthly', day(30), day(10), null);
    /*
     * Subtracting the full 30 days lands on T0, which is BEFORE the refund —
     * so it clamps to the refund instant. Both mean "no access now", but a
     * past expiry in the database would inflate the next stacking calculation,
     * since stacking anchors on the existing expiry.
     */
    expect(plan.targetExpiry.toISOString()).toBe(day(10).toISOString());
    expect(plan.survivorExpiry).toBeNull();
  });

  it('never writes an expiry before the refund itself', () => {
    /*
     * Subtracting a year from a nearly-spent window would land in the past. A
     * past expiry is not merely wrong-looking — it would inflate the NEXT
     * stacking calculation, since stacking anchors on the existing expiry.
     */
    const plan = planRevocation('annual', day(5), day(4), null);
    expect(plan.targetExpiry.getTime()).toBe(day(4).getTime());
  });
});

describe('a reversal behaves exactly like a refund', () => {
  it('produces the same plan for the same window', () => {
    const refund = planRevocation('monthly', day(30), day(10), null);
    const reversal = planRevocation('monthly', day(30), day(10), null);
    expect(reversal.targetExpiry.toISOString()).toBe(refund.targetExpiry.toISOString());
  });
});

describe('refunding the NEWER of two stacked payments', () => {
  /*
   *   A  starts T0    expires T0+30
   *   B  starts T0+10 expires T0+60   ← holds the entitlement
   */
  it('leaves the older payment untouched', () => {
    const survivor = { accessStartsAt: T0, accessExpiresAt: day(30) };
    const plan = planRevocation('monthly', day(60), day(20), survivor);

    expect(plan.targetExpiry.toISOString()).toBe(day(30).toISOString());
    /*
     * A already ends at the target, so nothing is written to it. Clamping here
     * would take away days a DIFFERENT successful payment paid for.
     */
    expect(plan.survivorExpiry).toBeNull();
  });
});

describe('refunding the OLDER of two stacked payments', () => {
  /*
   * The case that makes this non-trivial. A's row says T0+30, but the live
   * entitlement is B's T0+60. Nulling A alone revokes NOTHING.
   */
  const survivor = { accessStartsAt: day(10), accessExpiresAt: day(60) };

  it('claws the days back off the row that actually holds them', () => {
    const plan = planRevocation('monthly', day(60), day(20), survivor);
    expect(plan.targetExpiry.toISOString()).toBe(day(30).toISOString());
    // B is reduced to 30 days — exactly what B itself bought.
    expect(plan.survivorExpiry?.toISOString()).toBe(day(30).toISOString());
  });

  it('preserves the newer payment rather than cancelling it', () => {
    const plan = planRevocation('monthly', day(60), day(20), survivor);
    // Still in the future, still granting: B's own 30 days survive intact.
    expect(plan.survivorExpiry!.getTime()).toBeGreaterThan(day(20).getTime());
  });

  it('removes a year from a stacked annual without touching the monthly', () => {
    // A annual (T0 → T0+365), B monthly stacked (T0+10 → T0+395).
    const b = { accessStartsAt: day(10), accessExpiresAt: day(395) };
    const plan = planRevocation('annual', day(395), day(20), b);
    // 395 − 365 = 30: the monthly payment's own worth, kept.
    expect(plan.survivorExpiry?.toISOString()).toBe(day(30).toISOString());
  });

  it('subtracts only what the REFUNDED payment bought', () => {
    // Refunding a monthly must never remove a year.
    const b = { accessStartsAt: day(10), accessExpiresAt: day(395) };
    const monthly = planRevocation('monthly', day(395), day(20), b);
    expect(monthly.survivorExpiry?.toISOString()).toBe(day(365).toISOString());
  });
});

describe('the survivor row always stays valid', () => {
  it('never receives an expiry at or before its own start', () => {
    /*
     * The table requires access_expires_at > access_starts_at. A claw-back
     * reaching past the survivor's start would otherwise write a row the
     * database refuses.
     */
    const survivor = { accessStartsAt: day(29), accessExpiresAt: day(60) };
    const plan = planRevocation('annual', day(60), day(30), survivor);
    expect(plan.survivorExpiry!.getTime()).toBeGreaterThan(survivor.accessStartsAt.getTime());
  });

  it('floors to an instant that grants nothing, rather than a valid-looking future', () => {
    /*
     * The floor only bites when the claw-back reaches past the survivor's own
     * start — which needs a refund that PRECEDES the second purchase, i.e. a
     * late-delivered refund event for an earlier payment.
     */
    const survivor = { accessStartsAt: day(10), accessExpiresAt: day(60) };
    const plan = planRevocation('annual', day(60), day(5), survivor);
    // One millisecond past the start: in the past, so hasAccess() is false.
    expect(plan.survivorExpiry!.getTime()).toBe(survivor.accessStartsAt.getTime() + 1);
    expect(plan.survivorExpiry!.getTime()).toBeGreaterThan(survivor.accessStartsAt.getTime());
  });

  it('only ever reduces a survivor, never extends one', () => {
    /*
     * Target T0+30, survivor ends T0+10. Writing the target would EXTEND a
     * payment by ten days it never bought, so the survivor is left alone.
     */
    const survivor = { accessStartsAt: T0, accessExpiresAt: day(10) };
    const plan = planRevocation('monthly', day(60), day(2), survivor);
    expect(plan.targetExpiry.toISOString()).toBe(day(30).toISOString());
    expect(plan.survivorExpiry).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyRefund against a faked database
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  user_id: string;
  billing_interval: string;
  payment_status: string;
  access_starts_at: string | null;
  access_expires_at: string | null;
  refunded_at: string | null;
  reversed_at: string | null;
  provider_capture_id: string;
}

/** A tiny in-memory stand-in for the paypal_payments table. */
function fakeDb(rows: Row[]) {
  const state = rows.map((r) => ({ ...r }));
  const client = {
    from() {
      const filters: [string, unknown][] = [];
      let updates: Record<string, unknown> | null = null;
      let orderBy: { col: string; ascending: boolean } | null = null;
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          return chain;
        },
        /*
         * Really sorts. A no-op here made live[0] the first INSERTED row rather
         * than the furthest-out expiry, which fed planRevocation a current
         * expiry that was not the user's actual entitlement — and produced
         * plausible-looking wrong numbers rather than an obvious failure.
         */
        order: (col: string, opts?: { ascending?: boolean }) => {
          orderBy = { col, ascending: opts?.ascending !== false };
          return chain;
        },
        update: (patch: Record<string, unknown>) => {
          updates = patch;
          return chain;
        },
        maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
        then: undefined,
      } as Record<string, unknown> & {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };

      function match() {
        const hit = state.filter((row) =>
          filters.every(([col, val]) => (row as unknown as Record<string, unknown>)[col] === val),
        );
        if (orderBy) {
          const { col, ascending } = orderBy;
          hit.sort((a, b) => {
            const av = String((a as unknown as Record<string, unknown>)[col] ?? '');
            const bv = String((b as unknown as Record<string, unknown>)[col] ?? '');
            return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
          });
        }
        return hit;
      }

      // A select resolves as a thenable list; an update applies then returns.
      (chain as unknown as { then: unknown }).then = (
        resolve: (v: { data: unknown; error: unknown }) => void,
      ) => {
        const hit = match();
        if (updates) {
          for (const row of hit) Object.assign(row, updates);
          resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
        } else {
          resolve({ data: hit, error: null });
        }
      };
      return chain;
    },
  };
  return { client, state };
}

function completedRow(over: Partial<Row> = {}): Row {
  return {
    id: 'row-a',
    user_id: 'user-1',
    billing_interval: 'monthly',
    payment_status: 'COMPLETED',
    access_starts_at: T0.toISOString(),
    access_expires_at: day(30).toISOString(),
    refunded_at: null,
    reversed_at: null,
    provider_capture_id: 'CAPTURE0001',
    ...over,
  };
}

let applyRefund: typeof import('@/features/billing/providers/paypal/apply-refund').applyRefund;

beforeEach(async () => {
  vi.resetModules();
  ({ applyRefund } = await import('@/features/billing/providers/paypal/apply-refund'));
});

describe('applyRefund writes the right rows', () => {
  it('demotes the payment and nulls its window on a full refund', async () => {
    const { client, state } = fakeDb([completedRow()]);
    const result = await applyRefund(client as never, 'CAPTURE0001', 'REFUNDED', day(10));

    expect(result.outcome).toBe('applied');
    expect(state[0]!.payment_status).toBe('REFUNDED');
    expect(state[0]!.refunded_at).toBe(day(10).toISOString());
    // The table forbids a non-COMPLETED row holding a window, and nulling it is
    // also what removes the row from every entitlement read.
    expect(state[0]!.access_starts_at).toBeNull();
    expect(state[0]!.access_expires_at).toBeNull();
  });

  it('records a reversal under reversed_at, not refunded_at', async () => {
    const { client, state } = fakeDb([completedRow()]);
    await applyRefund(client as never, 'CAPTURE0001', 'REVERSED', day(10));
    expect(state[0]!.payment_status).toBe('REVERSED');
    expect(state[0]!.reversed_at).toBe(day(10).toISOString());
    expect(state[0]!.refunded_at).toBeNull();
  });

  it('acknowledges an unknown capture id without touching anything', async () => {
    const { client, state } = fakeDb([completedRow()]);
    const result = await applyRefund(client as never, 'NOSUCHCAPTURE', 'REFUNDED', day(10));
    expect(result.outcome).toBe('unknown_capture');
    expect(state[0]!.payment_status).toBe('COMPLETED');
  });

  it('is idempotent when the same refund is delivered twice', async () => {
    const { client, state } = fakeDb([completedRow()]);
    const first = await applyRefund(client as never, 'CAPTURE0001', 'REFUNDED', day(10));
    const second = await applyRefund(client as never, 'CAPTURE0001', 'REFUNDED', day(10));

    expect(first.outcome).toBe('applied');
    expect(second.outcome).toBe('already_refunded');
    // The claw-back was not applied a second time.
    expect(state[0]!.refunded_at).toBe(day(10).toISOString());
  });

  it('refuses a REVERSED that arrives after a REFUNDED for the same capture', async () => {
    const { client } = fakeDb([completedRow()]);
    await applyRefund(client as never, 'CAPTURE0001', 'REFUNDED', day(10));
    const late = await applyRefund(client as never, 'CAPTURE0001', 'REVERSED', day(12));
    expect(late.outcome).toBe('already_refunded');
  });

  it('treats a row already carrying refunded_at as done', async () => {
    const { client } = fakeDb([completedRow({ refunded_at: day(5).toISOString() })]);
    const result = await applyRefund(client as never, 'CAPTURE0001', 'REFUNDED', day(10));
    expect(result.outcome).toBe('already_refunded');
  });

  it('preserves a newer stacked payment when the older one is refunded', async () => {
    /*
     * A: T0 → T0+30 (being refunded).  B: T0+10 → T0+60 (holds entitlement).
     * B must survive, reduced to the 30 days B itself paid for.
     */
    const { client, state } = fakeDb([
      completedRow({ id: 'row-a', provider_capture_id: 'CAPTURE0001' }),
      completedRow({
        id: 'row-b',
        provider_capture_id: 'CAPTURE0002',
        access_starts_at: day(10).toISOString(),
        access_expires_at: day(60).toISOString(),
      }),
    ]);

    const result = await applyRefund(client as never, 'CAPTURE0001', 'REFUNDED', day(20));

    expect(result.outcome).toBe('applied');
    const a = state.find((r) => r.id === 'row-a')!;
    const b = state.find((r) => r.id === 'row-b')!;

    expect(a.payment_status).toBe('REFUNDED');
    // B is NOT cancelled — it stays a completed payment, still granting.
    expect(b.payment_status).toBe('COMPLETED');
    expect(b.access_expires_at).toBe(day(30).toISOString());
  });

  it('does not extend a surviving payment when the NEWER one is refunded', async () => {
    // Refunding B (the max holder) leaves A exactly as it was.
    const { client, state } = fakeDb([
      completedRow({ id: 'row-a', provider_capture_id: 'CAPTURE0001' }),
      completedRow({
        id: 'row-b',
        provider_capture_id: 'CAPTURE0002',
        access_starts_at: day(10).toISOString(),
        access_expires_at: day(60).toISOString(),
      }),
    ]);

    await applyRefund(client as never, 'CAPTURE0002', 'REFUNDED', day(20));

    const a = state.find((r) => r.id === 'row-a')!;
    expect(a.payment_status).toBe('COMPLETED');
    expect(a.access_expires_at).toBe(day(30).toISOString());
  });
});

/**
 * The capture action end to end, with PayPal and the database faked.
 *
 * The pure verifier is covered in paypal-orders.test.ts; what is tested HERE is
 * the part that writes: that a verified capture produces exactly one row with
 * server-derived values, that a rejected one produces none at all, and that the
 * same capture arriving twice grants access once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PLANS } from '@/features/billing/plans';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = 'ORDER123456789AB';
const CAPTURED_AT = '2026-08-01T12:00:00.000Z';

/*
 * `vi.mock` factories are hoisted above every import, so anything they close
 * over must be hoisted with them. `vi.hoisted` is the sanctioned way to share
 * mutable state with a factory — declaring these as plain consts fails with
 * "cannot access before initialization".
 */
const h = vi.hoisted(() => ({
  captureOrder: vi.fn(),
  getOrder: vi.fn(),
  createOrder: vi.fn(),
  /** Who `auth.getUser()` reports. */
  currentUser: null as string | null,
  /** Rows written, in order, tagged with their table. */
  inserts: [] as { table: string; row: Record<string, unknown> }[],
  /** Queued `maybeSingle()` answers, consumed in order. */
  selectResults: [] as { data: unknown }[],
  /** What the paypal_payments insert returns. */
  insertResult: { error: null } as { error: { code: string } | null },
}));

const { captureOrder, getOrder } = h;

vi.mock('@/features/billing/providers/paypal/orders', async (importOriginal) => {
  // Keep the real PayPalOrderError, ORDER_CURRENCY and amount helpers — the
  // capture path branches on `instanceof`, so a fake class would not exercise it.
  const actual =
    await importOriginal<typeof import('@/features/billing/providers/paypal/orders')>();
  return {
    ...actual,
    captureOrder: h.captureOrder,
    getOrder: h.getOrder,
    createOrder: h.createOrder,
  };
});

vi.mock('@/features/billing/providers/paypal/client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/billing/providers/paypal/client')>();
  return { ...actual, isPayPalConfigured: () => true };
});

// --- Supabase ------------------------------------------------------------
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: h.currentUser ? { id: h.currentUser } : null } }),
    },
  }),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gt: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => h.selectResults.shift() ?? { data: null },
        insert: async (row: Record<string, unknown>) => {
          h.inserts.push({ table, row });
          return table === 'paypal_payments' ? h.insertResult : { error: null };
        },
      };
      return chain;
    },
  }),
}));

import {
  capturePayPalOrderAction,
  createPayPalOrderAction,
} from '@/features/billing/providers/paypal/order-actions';

function paypalOrder(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    status: 'COMPLETED',
    purchase_units: [
      {
        reference_id: (over.reference as string) ?? 'pro:monthly',
        custom_id: 'customId' in over ? (over.customId as string) : USER,
        amount: { currency_code: 'USD', value: '39.00' },
        payments: {
          captures: [
            {
              id: (over.captureId as string) ?? 'CAPTURE0001',
              status: (over.status as string) ?? 'COMPLETED',
              amount: {
                currency_code: (over.currency as string) ?? 'USD',
                value: (over.value as string) ?? '39.00',
              },
              create_time: CAPTURED_AT,
            },
          ],
        },
      },
    ],
  };
}

/** Only the rows that actually grant access. */
const payments = () => h.inserts.filter((i) => i.table === 'paypal_payments');

/** The single written payment row, failing loudly if there isn't exactly one. */
function paymentRow(): Record<string, unknown> {
  const rows = payments();
  const [only] = rows;
  if (!only || rows.length !== 1) {
    throw new Error(`expected exactly 1 payment row, found ${rows.length}`);
  }
  return only.row;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.inserts = [];
  h.selectResults = [];
  h.insertResult = { error: null };
  h.currentUser = USER;
  captureOrder.mockResolvedValue(paypalOrder());
});

describe('a verified capture writes exactly one grant', () => {
  it('records server-derived tier, interval, amount, currency and window', async () => {
    // No prior access on file.
    h.selectResults = [{ data: null }];

    const result = await capturePayPalOrderAction(ORDER_ID);

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('granted');
    expect(result.tier).toBe('pro');

    const row = paymentRow();
    expect(row.user_id).toBe(USER);
    expect(row.provider_capture_id).toBe('CAPTURE0001');
    expect(row.provider_order_id).toBe(ORDER_ID);
    expect(row.tier).toBe('pro');
    expect(row.billing_interval).toBe('monthly');
    // Re-derived from the pricing config, not read off the PayPal response.
    expect(row.amount).toBe(PLANS.pro.priceMonthly);
    expect(row.payment_status).toBe('COMPLETED');
    expect(row.paid_at).toBe(CAPTURED_AT);
    // 30 days from the capture instant.
    expect(row.access_starts_at).toBe(CAPTURED_AT);
    expect(row.access_expires_at).toBe('2026-08-31T12:00:00.000Z');
  });

  it('writes the currency in the UPPERCASE the table demands', async () => {
    /*
     * The app's plan config stores 'usd' lowercase while the column checks for
     * 'USD'. Getting this wrong makes every single capture fail its check
     * constraint AFTER the money has moved, so it is pinned here.
     */
    h.selectResults = [{ data: null }];
    await capturePayPalOrderAction(ORDER_ID);
    expect(paymentRow().currency).toBe('USD');
  });

  it('stacks onto access the user already holds', async () => {
    // 19 days still to run.
    h.selectResults = [{ data: { access_expires_at: '2026-08-20T12:00:00.000Z' } }];

    const result = await capturePayPalOrderAction(ORDER_ID);

    expect(result.outcome).toBe('granted');
    // 20 Aug + 30 days — the days already paid for are not forfeited.
    expect(paymentRow().access_expires_at).toBe('2026-09-19T12:00:00.000Z');
    expect(result.accessExpiresAt).toBe('2026-09-19T12:00:00.000Z');
  });

  it('restarts from the capture when the previous window has expired', async () => {
    h.selectResults = [{ data: { access_expires_at: '2026-07-01T12:00:00.000Z' } }];
    await capturePayPalOrderAction(ORDER_ID);
    // Expired time is not retroactively credited.
    expect(paymentRow().access_expires_at).toBe('2026-08-31T12:00:00.000Z');
  });
});

describe('the same capture cannot grant twice', () => {
  it('treats a unique violation as already applied, not as an error', async () => {
    // The insert loses the race against the unique index on provider_capture_id.
    h.selectResults = [
      { data: null },
      { data: { tier: 'pro', access_expires_at: '2026-08-31T12:00:00.000Z' } },
    ];
    h.insertResult = { error: { code: '23505' } };

    const result = await capturePayPalOrderAction(ORDER_ID);

    // Idempotent: a success for the caller, with the access already on file.
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('already_granted');
    expect(result.tier).toBe('pro');
    expect(result.accessExpiresAt).toBe('2026-08-31T12:00:00.000Z');
  });

  it('does not extend the window when the capture is replayed', async () => {
    h.selectResults = [
      { data: { access_expires_at: '2026-08-31T12:00:00.000Z' } },
      { data: { tier: 'pro', access_expires_at: '2026-08-31T12:00:00.000Z' } },
    ];
    h.insertResult = { error: { code: '23505' } };

    const result = await capturePayPalOrderAction(ORDER_ID);

    // The expiry reported back is the one already stored — the replay bought
    // nothing, even though the arithmetic upstream would have stacked.
    expect(result.accessExpiresAt).toBe('2026-08-31T12:00:00.000Z');
    // One insert was ATTEMPTED, and the database refused it. That is the point:
    // the guarantee is the index, not a prior read.
    expect(payments()).toHaveLength(1);
  });

  it('recovers when PayPal itself says the order was already captured', async () => {
    const { PayPalOrderError, ALREADY_CAPTURED } =
      await import('@/features/billing/providers/paypal/orders');
    captureOrder.mockRejectedValue(new PayPalOrderError(422, ALREADY_CAPTURED, 'already'));
    getOrder.mockResolvedValue(paypalOrder());
    h.selectResults = [
      { data: null },
      { data: { tier: 'pro', access_expires_at: '2026-08-31T12:00:00.000Z' } },
    ];
    h.insertResult = { error: { code: '23505' } };

    const result = await capturePayPalOrderAction(ORDER_ID);

    // Not a decline — PayPal refusing to charge twice is a success path.
    expect(getOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('already_granted');
  });
});

describe('a refused capture writes nothing at all', () => {
  it.each([
    ['a wrong amount', { value: '0.01' }, 'wrong_amount'],
    ['a wrong currency', { currency: 'EUR' }, 'wrong_currency'],
    ["another user's payment", { customId: OTHER_USER }, 'not_yours'],
    ['an unsettled payment', { status: 'PENDING' }, 'not_completed'],
    ['an unknown product', { reference: 'enterprise:monthly' }, 'unknown_reference'],
  ])('refuses %s and grants nothing', async (_label, over, reason) => {
    captureOrder.mockResolvedValue(paypalOrder(over));
    h.selectResults = [{ data: null }];

    const result = await capturePayPalOrderAction(ORDER_ID);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toBe(reason);
    /*
     * No payment row — not even a non-COMPLETED one. Recording a rejection
     * would mean binding a payment we just refused to this user's account, and
     * for `not_yours` that is exactly the thing being prevented.
     */
    expect(payments()).toHaveLength(0);
    // It is still audited, so a refusal is never silent.
    expect(h.inserts.some((i) => i.table === 'billing_audit')).toBe(true);
  });
});

describe('the action refuses before it reaches PayPal', () => {
  it('requires a signed-in caller', async () => {
    h.currentUser = null;
    const result = await capturePayPalOrderAction(ORDER_ID);
    expect(result.outcome).toBe('unauthenticated');
    expect(captureOrder).not.toHaveBeenCalled();
    expect(payments()).toHaveLength(0);
  });

  it.each(['', 'not an id', '../../etc/passwd', 'order123', 'A'.repeat(64)])(
    'rejects the malformed order reference %j',
    async (bad) => {
      const result = await capturePayPalOrderAction(bad);
      expect(result.outcome).toBe('invalid_order');
      expect(captureOrder).not.toHaveBeenCalled();
    },
  );
});

describe('a payment we cannot record is never reported as access', () => {
  it('says so plainly and names the payment reference', async () => {
    h.selectResults = [{ data: null }];
    h.insertResult = { error: { code: '08006' } }; // connection failure

    const result = await capturePayPalOrderAction(ORDER_ID);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('error');
    expect(result.tier).toBeUndefined();
    // The buyer is given the reference they will need to get it reconciled.
    expect(result.message).toContain(ORDER_ID);
    expect(h.inserts.some((i) => i.table === 'billing_audit')).toBe(true);
  });
});

describe('the browser receives only a PayPal order id', () => {
  it('returns exactly { ok, orderId } and nothing else PayPal sent back', async () => {
    /*
     * PayPal's create-order response carries links, a status and (once the
     * buyer is known) payer detail. None of it is the browser's business, and
     * spreading the response into the result is the easy way to leak it. The
     * assertion is on the exact key set, not on the absence of one field.
     */
    h.createOrder.mockResolvedValue({
      id: 'ORDER123456789AB',
      status: 'CREATED',
      links: [{ href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/X', rel: 'self' }],
      payer: { email_address: 'buyer@example.com' },
      purchase_units: [{ custom_id: USER, amount: { value: '39.00' } }],
    });

    const result = await createPayPalOrderAction('pro', 'monthly');

    expect(result.ok).toBe(true);
    expect(result.orderId).toBe('ORDER123456789AB');
    expect(Object.keys(result).sort()).toEqual(['ok', 'orderId']);
    expect(JSON.stringify(result)).not.toContain('buyer@example.com');
    expect(JSON.stringify(result)).not.toContain('links');
  });

  it('refuses a tier that is not for sale, without calling PayPal', async () => {
    const result = await createPayPalOrderAction('free' as never, 'monthly');
    expect(result.ok).toBe(false);
    expect(result.orderId).toBeUndefined();
    expect(h.createOrder).not.toHaveBeenCalled();
  });

  it('requires a signed-in caller before creating an order', async () => {
    h.currentUser = null;
    const result = await createPayPalOrderAction('pro', 'monthly');
    expect(result.ok).toBe(false);
    expect(result.orderId).toBeUndefined();
    expect(h.createOrder).not.toHaveBeenCalled();
  });
});

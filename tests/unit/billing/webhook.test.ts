import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature, computeSignature } from '@/features/billing/providers/signature';
import { interpretEvent, applyBillingEvent } from '@/features/billing/webhook';
import { MockBillingProvider } from '@/features/billing/providers/mock';
import type { BillingEvent } from '@/features/billing/types';

const SECRET = 'whsec_test';

function signed(payload: string, ts = Math.floor(Date.now() / 1000)): string {
  return `t=${ts},v1=${computeSignature(payload, ts, SECRET)}`;
}

describe('webhook signature verification (mandatory)', () => {
  it('accepts a valid signature within tolerance', () => {
    const payload = '{"id":"evt_1"}';
    expect(verifyWebhookSignature(payload, signed(payload), SECRET)).toBe(true);
  });

  it('rejects a tampered payload, wrong secret, and expired timestamp', () => {
    const payload = '{"id":"evt_1"}';
    const header = signed(payload);
    expect(verifyWebhookSignature('{"id":"evil"}', header, SECRET)).toBe(false);
    expect(verifyWebhookSignature(payload, header, 'wrong_secret')).toBe(false);
    const old = Math.floor(Date.now() / 1000) - 10_000;
    expect(verifyWebhookSignature(payload, signed(payload, old), SECRET)).toBe(false);
  });

  it('the mock provider rejects unsigned events (no side effects on forgery)', () => {
    const provider = new MockBillingProvider(SECRET);
    expect(() => provider.constructEvent('{"id":"e","type":"x"}', 'bad')).toThrow();
  });
});

describe('event interpretation (pure; no money math; no card data)', () => {
  function ev(type: string, data: Record<string, unknown>): BillingEvent {
    return { id: 'evt', type, createdAt: 1000, data };
  }

  it('maps subscription events to a mirror update via metadata tier', () => {
    const u = interpretEvent(
      ev('customer.subscription.updated', {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        current_period_end: 2000,
        cancel_at_period_end: false,
        metadata: { tier: 'pro' },
      }),
    );
    expect(u.kind).toBe('subscription');
    expect(u.subscription?.tier).toBe('pro');
    expect(u.subscription?.status).toBe('active');
  });

  it('resolves tier from the price→tier map', () => {
    const u = interpretEvent(
      ev('customer.subscription.created', {
        id: 'sub_2',
        customer: 'cus_2',
        status: 'trialing',
        items: { data: [{ price: { id: 'price_x' } }] },
      }),
      { price_x: 'trader' },
    );
    expect(u.subscription?.tier).toBe('trader');
  });

  it('never carries card-like fields into the mirror update', () => {
    const u = interpretEvent(
      ev('customer.subscription.updated', {
        id: 'sub',
        customer: 'cus',
        status: 'active',
        metadata: { tier: 'pro' },
        // A hostile/extra payload must not be mirrored.
        card_number: '4242424242424242',
        cvc: '123',
      }),
    );
    const json = JSON.stringify(u);
    expect(json).not.toContain('4242');
    expect(json).not.toContain('cvc');
  });

  it('ignores unrelated event types', () => {
    expect(interpretEvent(ev('customer.updated', { customer: 'c' })).kind).toBe('ignore');
  });
});

/** Minimal in-memory Supabase stand-in for applyBillingEvent's call pattern. */
function fakeSupabase(opts: { customerUserId?: string; lastEventAt?: number } = {}) {
  const seenEvents = new Set<string>();
  const upserts: { table: string; row: Record<string, unknown> }[] = [];
  const api = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          if (table === 'billing_events') {
            const id = row.event_id as string;
            if (seenEvents.has(id)) return Promise.resolve({ error: { code: '23505' } });
            seenEvents.add(id);
            return Promise.resolve({ error: null });
          }
          return Promise.resolve({ error: null });
        },
        upsert(row: Record<string, unknown>) {
          upserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  if (table === 'billing_customers') {
                    return Promise.resolve(
                      opts.customerUserId
                        ? { data: { user_id: opts.customerUserId } }
                        : { data: null },
                    );
                  }
                  if (table === 'billing_subscriptions') {
                    return Promise.resolve({ data: { last_event_at: opts.lastEventAt ?? 0 } });
                  }
                  return Promise.resolve({ data: null });
                },
              };
            },
          };
        },
      };
    },
  };
  return { api, upserts, seenEvents };
}

describe('idempotent + out-of-order-safe application', () => {
  function subEvent(id: string, createdAt: number): BillingEvent {
    return {
      id,
      type: 'customer.subscription.updated',
      createdAt,
      data: { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { tier: 'pro' } },
    };
  }

  it('applies a fresh event and mirrors the subscription', async () => {
    const { api, upserts } = fakeSupabase({ customerUserId: 'user_1' });
    const r = await applyBillingEvent(api as never, subEvent('evt_1', 100));
    expect(r.applied).toBe(true);
    expect(upserts.find((u) => u.table === 'billing_subscriptions')?.row.tier).toBe('pro');
  });

  it('IDEMPOTENT: a duplicate/replayed event id does not re-apply', async () => {
    const fake = fakeSupabase({ customerUserId: 'user_1' });
    await applyBillingEvent(fake.api as never, subEvent('evt_dup', 100));
    const upsertsAfterFirst = fake.upserts.length;
    const second = await applyBillingEvent(fake.api as never, subEvent('evt_dup', 100));
    expect(second.duplicate).toBe(true);
    expect(second.applied).toBe(false);
    expect(fake.upserts.length).toBe(upsertsAfterFirst); // no second mirror write
  });

  it('OUT-OF-ORDER: an event older than the last applied is ignored', async () => {
    const { api } = fakeSupabase({ customerUserId: 'user_1', lastEventAt: 500 });
    const r = await applyBillingEvent(api as never, subEvent('evt_old', 100));
    expect(r.applied).toBe(false);
    expect(r.reason).toMatch(/stale/i);
  });

  it('ignores events for an unknown customer (no cross-user apply)', async () => {
    const { api } = fakeSupabase({ customerUserId: undefined });
    const r = await applyBillingEvent(api as never, subEvent('evt_x', 100));
    expect(r.applied).toBe(false);
    expect(r.reason).toMatch(/unknown customer/i);
  });
});

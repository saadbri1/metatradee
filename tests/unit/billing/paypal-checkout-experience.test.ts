/**
 * Which hosted PayPal page the buyer actually lands on.
 *
 * A real defect these lock: the order was created without `landing_page`, so
 * PayPal applied its documented default of NO_PREFERENCE and routed buyers to
 * BILLING — the card/registration page whose CTA reads "Create Account & Pay"
 * and which offers no usable way back to an existing PayPal account. A buyer
 * who already had an account could not use it.
 *
 * The client integration was NOT the cause and is pinned here too, because the
 * obvious-looking suspects (vault, intent=subscription, enable-funding, a card
 * button as the primary CTA) are exactly what a future change might reintroduce
 * while chasing the same symptom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createOrder } from '@/features/billing/providers/paypal/orders';
import { __resetTokenCache, type PayPalConfig } from '@/features/billing/providers/paypal/client';

const CFG: PayPalConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-secret',
  webhookId: 'test-webhook',
  baseUrl: 'https://api-m.sandbox.paypal.com',
  environment: 'sandbox',
};

/** Token call, then the Orders call. */
function mockPayPal(orderBody: unknown = { id: 'ORDER123456789AB' }) {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token', expires_in: 3000 }),
    })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => orderBody });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The JSON body of the Orders POST. */
function orderBodyFrom(fetchMock: ReturnType<typeof vi.fn>): Record<string, never> {
  const call = fetchMock.mock.calls[1];
  if (!call) throw new Error('the Orders API was never called');
  const init = call[1] as { body?: string };
  if (!init?.body) throw new Error('the Orders call carried no body');
  return JSON.parse(init.body);
}

beforeEach(() => {
  __resetTokenCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the order asks for the existing-account login page', () => {
  it('sends landing_page LOGIN, never BILLING and never absent', async () => {
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);

    const body = orderBodyFrom(fetchMock) as unknown as {
      application_context?: { landing_page?: string };
    };
    /*
     * Absent is NOT equivalent to a sensible default here: absent means
     * NO_PREFERENCE, and NO_PREFERENCE is what produced the guest
     * account-creation flow. The assertion is on the explicit value.
     */
    expect(body.application_context?.landing_page).toBe('LOGIN');
  });

  it('still suppresses shipping and asks for a PAY_NOW confirmation', async () => {
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);
    const body = orderBodyFrom(fetchMock) as unknown as {
      application_context?: { shipping_preference?: string; user_action?: string };
    };
    expect(body.application_context?.shipping_preference).toBe('NO_SHIPPING');
    expect(body.application_context?.user_action).toBe('PAY_NOW');
  });

  it('creates a CAPTURE order and never a vaulted or billing-agreement one', async () => {
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);

    const [url, init] = fetchMock.mock.calls[1] as [string, { method?: string; body?: string }];
    // The Orders API, not Subscriptions or Billing Agreements.
    expect(url).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders');
    expect(init.method).toBe('POST');

    const raw = init.body ?? '';
    expect(JSON.parse(raw).intent).toBe('CAPTURE');
    expect(raw).not.toMatch(/vault/i);
    expect(raw).not.toMatch(/subscription/i);
    expect(raw).not.toMatch(/billing_agreement/i);
  });

  it('returns only an order id to the caller', async () => {
    const fetchMock = mockPayPal({ id: 'ORDER123456789AB', status: 'CREATED' });
    const order = await createOrder(3900, 'pro:monthly', 'user-1', CFG);
    expect(order.id).toBe('ORDER123456789AB');
    // Nothing about the buyer comes back through this call.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('the SDK URL carries exactly the five parameters it should', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../src/features/billing/components/paypal-pay-button.tsx'),
    'utf8',
  );

  /*
   * Only the URLSearchParams literal, with comments stripped. Asserting
   * against the whole file gave a false failure on the word "vaulting" in a
   * comment — and would have kept passing if a real `vault: 'true'` were
   * added next to it, since the naive check could not tell the two apart.
   */
  const params = (() => {
    const start = source.indexOf('new URLSearchParams({');
    const end = source.indexOf('});', start);
    if (start === -1 || end === -1) throw new Error('could not locate the SDK parameter block');
    return source
      .slice(start, end)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
  })();

  it.each([
    ["'client-id': clientId", 'client-id'],
    ["intent: 'capture'", 'intent=capture'],
    ["currency: 'USD'", 'currency=USD'],
    ["locale: 'en_US'", 'locale=en_US'],
    ["components: 'buttons'", 'components=buttons'],
  ])('includes %s', (fragment) => {
    expect(params).toContain(fragment);
  });

  it('sends those five keys and nothing else', () => {
    const keys = [...params.matchAll(/^\s*'?([a-z-]+)'?\s*:/gim)].map((m) => m[1]);
    expect(keys.sort()).toEqual(['client-id', 'components', 'currency', 'intent', 'locale'].sort());
  });

  it.each(['vault', 'enable-funding', 'disable-funding', 'buyer-country', 'subscription'])(
    'never sends %s',
    (param) => {
      expect(params).not.toContain(param);
    },
  );

  it('never requests a card-entry component alongside the buttons', () => {
    // hosted-fields / card-fields would put a card form on the page itself.
    expect(params).not.toContain('hosted-fields');
    expect(params).not.toContain('card-fields');
    expect(params).toMatch(/components:\s*'buttons'/);
  });
});

describe('the primary button is the PayPal wallet, not a card button', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../src/features/billing/components/paypal-pay-button.tsx'),
    'utf8',
  );

  it('renders the PAYPAL funding source explicitly', () => {
    /*
     * Without this the SDK picks for us, and in some buyer locales it leads
     * with the guest card form — a different route to the same symptom.
     */
    expect(source).toContain('fundingSource: window.paypal.FUNDING?.PAYPAL');
    expect(source).not.toContain('FUNDING.CARD');
    expect(source).not.toContain('FUNDING.CREDIT');
  });

  it('labels the button "pay", never "subscribe"', () => {
    expect(source).toContain("label: 'pay'");
    expect(source).not.toContain("label: 'subscribe'");
  });

  it('hands PayPal an order id from createOrder, not a plan or a price', () => {
    expect(source).toContain('createOrder:');
    expect(source).toContain('return result.orderId;');
    expect(source).not.toContain('createSubscription');
    expect(source).not.toContain('plan_id');
  });
});

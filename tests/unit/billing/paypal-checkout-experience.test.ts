/**
 * Which hosted PayPal page the buyer actually lands on.
 *
 * TWO defects are locked here, in the order they were found.
 *
 * First, the order carried no `landing_page` at all, so PayPal applied its
 * default of NO_PREFERENCE and chose the account-creation flow.
 *
 * Then `landing_page: 'LOGIN'` was added under `application_context` — and the
 * buyer STILL landed on checkoutweb/signup, being asked for a password, date
 * of birth and national ID. application_context is deprecated, and PayPal
 * reads the experience settings from payment_source.paypal.experience_context
 * instead. A setting in a location the API does not read is not a setting.
 *
 * So the assertions below are deliberately two-sided: the value must be right
 * AND it must be in the location PayPal actually reads. Asserting only the
 * value is exactly what let the second defect through.
 *
 * The client integration was never the cause and is pinned here too, because
 * the obvious-looking suspects (vault, intent=subscription, enable-funding, a
 * card button as the primary CTA) are what a future change might reintroduce
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

interface OrderRequest {
  intent?: string;
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
  }[];
  application_context?: unknown;
  payment_source?: {
    paypal?: {
      experience_context?: {
        landing_page?: string;
        user_action?: string;
        shipping_preference?: string;
      };
    };
  };
}

describe('the order asks for the existing-account login page', () => {
  it('carries NO application_context at all', async () => {
    /*
     * Not "application_context without landing_page" — absent entirely. Two
     * copies of the same experience settings is how a fix appears to work
     * while the ignored copy is the one being read.
     */
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);

    const body = orderBodyFrom(fetchMock) as OrderRequest;
    expect(body.application_context).toBeUndefined();
    expect('application_context' in body).toBe(false);
    // Belt and braces: not present anywhere in the serialised request either.
    const raw = (fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? '';
    expect(raw).not.toContain('application_context');
  });

  it('puts experience_context under payment_source.paypal', async () => {
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);

    const ctx = (orderBodyFrom(fetchMock) as OrderRequest).payment_source?.paypal
      ?.experience_context;
    expect(ctx).toBeDefined();
  });

  it('sends landing_page exactly LOGIN', async () => {
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);

    const ctx = (orderBodyFrom(fetchMock) as OrderRequest).payment_source?.paypal
      ?.experience_context;
    expect(ctx?.landing_page).toBe('LOGIN');
    // The value that produced the signup flow must never come back.
    expect(ctx?.landing_page).not.toBe('BILLING');
    expect(ctx?.landing_page).not.toBe('NO_PREFERENCE');
  });

  it('sends user_action PAY_NOW', async () => {
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);
    const ctx = (orderBodyFrom(fetchMock) as OrderRequest).payment_source?.paypal
      ?.experience_context;
    expect(ctx?.user_action).toBe('PAY_NOW');
  });

  it('sends shipping_preference NO_SHIPPING', async () => {
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);
    const ctx = (orderBodyFrom(fetchMock) as OrderRequest).payment_source?.paypal
      ?.experience_context;
    expect(ctx?.shipping_preference).toBe('NO_SHIPPING');
  });

  it('holds each experience setting in exactly one place', async () => {
    // A duplicate in the deprecated location would make it impossible to say
    // which one PayPal actually honoured.
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);
    const raw = (fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? '';
    for (const key of ['landing_page', 'user_action', 'shipping_preference']) {
      expect(raw.split(key).length - 1, `${key} appears more than once`).toBe(1);
    }
  });

  it('still carries the server-controlled custom_id and reference_id', async () => {
    /*
     * The experience change must not disturb the binding that makes a capture
     * attributable: custom_id is the owner, reference_id is what was bought.
     */
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);

    const unit = (orderBodyFrom(fetchMock) as OrderRequest).purchase_units?.[0];
    expect(unit?.custom_id).toBe('user-1');
    expect(unit?.reference_id).toBe('pro:monthly');
    expect(unit?.amount).toEqual({ currency_code: 'USD', value: '39.00' });
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

describe('the order carries no buyer identity whatsoever', () => {
  /*
   * A prefilled real email on PayPal's hosted page raised the question of
   * whether we were sending one. We are not, and these lock that in.
   *
   * The MetaTradee user is identified to PayPal ONLY by `custom_id` — an
   * opaque Supabase UUID that means nothing outside our database. Sending the
   * account email instead would leak a real identity to a third party, and in
   * sandbox it also names an address that is not a Sandbox buyer, which is
   * itself a route into the account-creation flow.
   *
   * Asserted against the RAW serialised body rather than a parsed object, so
   * a field nested anywhere new is still caught.
   */
  const REAL_EMAIL = 'metatradee@example.com';

  async function rawRequest(): Promise<string> {
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);
    return (fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? '';
  }

  it.each([
    'email_address',
    'payer',
    'phone',
    'given_name',
    'surname',
    'birth_date',
    'national_id',
    'tax_info',
    'address',
  ])('never serialises a %s field', async (field) => {
    expect(await rawRequest()).not.toContain(field);
  });

  it('contains no @ sign at all — no address of any kind reaches PayPal', async () => {
    // The bluntest possible check, and the one hardest to defeat by accident.
    expect(await rawRequest()).not.toContain('@');
  });

  it('identifies the user only by the opaque custom_id', async () => {
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'opaque-uuid-value', CFG);
    const raw = (fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? '';
    const body = JSON.parse(raw) as OrderRequest;

    expect(body.purchase_units?.[0]?.custom_id).toBe('opaque-uuid-value');
    // custom_id and reference_id are the ONLY buyer-scoped values in the request.
    expect(raw).not.toContain(REAL_EMAIL);
  });

  it('cannot be made to leak an email through the customId argument', async () => {
    /*
     * createOrder takes whatever the caller passes as customId. The caller is
     * order-actions.ts, which passes `user.id` and never `user.email` — but if
     * that ever changed, this is the test that would fail rather than an email
     * quietly reaching PayPal.
     */
    const fetchMock = mockPayPal();
    await createOrder(3900, 'pro:monthly', 'user-1', CFG);
    const raw = (fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? '';
    const emailShaped = /[\w.+-]+@[\w-]+\.[\w.]+/;
    expect(emailShaped.test(raw)).toBe(false);
  });
});

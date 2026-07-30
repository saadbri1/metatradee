/**
 * PayPal SDK configuration and the createSubscription payload.
 *
 * These exist because of a real defect: `custom_id` was described in a comment
 * but never actually sent. PayPal therefore returned subscriptions with no
 * owner, server verification refused every one as "not yours", and the webhook
 * dropped them as unattributable — a buyer could pay and receive nothing. A
 * comment is not a test, so the payload is now asserted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('@/features/billing/providers/paypal/verify-action', () => ({
  verifyPayPalSubscriptionAction: vi.fn(),
}));

import { PayPalSubscribeButton } from '@/features/billing/components/paypal-button';

const USER = '11111111-2222-3333-4444-555555555555';
const PLAN = 'P-TRADER-MONTHLY-1';

/** Captures what the component hands the SDK. */
let buttonOpts: Record<string, unknown> | null = null;
let scriptSrc = '';

/*
 * The component injects a real <script>. jsdom will not fetch it, so we let the
 * append happen for real (that is the thing under test — the URL), then stand
 * up a fake SDK and fire onload ourselves.
 *
 * Spying on appendChild was the wrong seam: it intercepted the node before the
 * component finished wiring it, and reported an empty src.
 */
beforeEach(() => {
  buttonOpts = null;
  scriptSrc = '';
  (window as unknown as { paypal: unknown }).paypal = {
    FUNDING: { PAYPAL: 'paypal', CARD: 'card' },
    Buttons: (opts: Record<string, unknown>) => {
      buttonOpts = opts;
      return { render: () => Promise.resolve() };
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { paypal?: unknown }).paypal;
  document.querySelectorAll('script[src*="paypal"]').forEach((n) => n.remove());
});

function renderButton() {
  return render(
    <PayPalSubscribeButton
      clientId="AXpublicClientId"
      paypalPlanId={PLAN}
      userId={USER}
      tier="trader"
      interval="monthly"
    />,
  );
}

/**
 * The loader short-circuits when window.paypal already exists, so to observe
 * the URL we must load the module fresh with no SDK present.
 */
async function captureSdkUrl(): Promise<string> {
  delete (window as unknown as { paypal?: unknown }).paypal;
  vi.resetModules();
  const mod = await import('@/features/billing/components/paypal-button');
  const { render: r } = await import('@testing-library/react');
  r(
    <mod.PayPalSubscribeButton
      clientId="AXpublicClientId"
      paypalPlanId={PLAN}
      userId={USER}
      tier="trader"
      interval="monthly"
    />,
  );
  const el = await waitFor(() => {
    const node = document.querySelector('script[src*="/sdk/js"]') as HTMLScriptElement | null;
    if (!node) throw new Error('no sdk script yet');
    return node;
  });
  return el.src;
}

describe('SDK query parameters', () => {
  it('loads with the parameters PayPal Subscriptions requires', async () => {
    scriptSrc = await captureSdkUrl();
    const params = new URL(scriptSrc).searchParams;

    // Both are mandatory for subscriptions — a one-off payment intent would
    // never create a billing agreement.
    expect(params.get('vault')).toBe('true');
    expect(params.get('intent')).toBe('subscription');
    expect(params.get('client-id')).toBe('AXpublicClientId');
    expect(params.get('currency')).toBe('USD');
  });

  it('never puts a secret in the SDK URL', async () => {
    scriptSrc = await captureSdkUrl();
    expect(scriptSrc).not.toMatch(/secret/i);
    expect(scriptSrc).not.toMatch(/client-secret/i);
  });

  it('enables the PayPal wallet as a funding source', async () => {
    scriptSrc = await captureSdkUrl();
    expect(new URL(scriptSrc).searchParams.get('enable-funding')).toContain('paypal');
  });

  it('does not disable card funding — guest card may remain as its own button', async () => {
    // Requirement: card must not be suppressed, it just must not stand in for
    // the wallet flow.
    scriptSrc = await captureSdkUrl();
    expect(new URL(scriptSrc).searchParams.get('disable-funding')).toBeNull();
  });
});

describe('the rendered button is the PayPal-account flow', () => {
  it('renders the PAYPAL funding source explicitly', async () => {
    renderButton();
    await waitFor(() => expect(buttonOpts).not.toBeNull());
    // Without this the SDK chooses, and in some buyer locales it leads with
    // the guest card form instead of PayPal login.
    expect(buttonOpts!.fundingSource).toBe('paypal');
  });

  it('uses the subscribe label', async () => {
    renderButton();
    await waitFor(() => expect(buttonOpts).not.toBeNull());
    expect((buttonOpts!.style as Record<string, unknown>).label).toBe('subscribe');
  });
});

describe('createSubscription payload', () => {
  async function capturePayload() {
    renderButton();
    await waitFor(() => expect(buttonOpts).not.toBeNull());
    const create = buttonOpts!.createSubscription as (d: unknown, a: unknown) => Promise<string>;
    let sent: Record<string, unknown> | null = null;
    const actions = {
      subscription: {
        create: (payload: Record<string, unknown>) => {
          sent = payload;
          return Promise.resolve('I-ABC123');
        },
      },
    };
    await create({}, actions);
    return sent!;
  }

  it('sends the exact configured plan id', async () => {
    const payload = await capturePayload();
    expect(payload.plan_id).toBe(PLAN);
  });

  it('SENDS custom_id — the defect this suite exists for', async () => {
    const payload = await capturePayload();
    expect(payload.custom_id).toBe(USER);
  });

  it('sends nothing that could let the client set its own price or tier', async () => {
    const payload = await capturePayload();
    // Only these two keys. A plan_id maps to a price server-side; anything
    // else here would be the client describing its own purchase.
    expect(Object.keys(payload).sort()).toEqual(['custom_id', 'plan_id']);
    expect(payload).not.toHaveProperty('amount');
    expect(payload).not.toHaveProperty('price');
    expect(payload).not.toHaveProperty('tier');
  });
});

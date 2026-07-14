/**
 * Stripe adapter — fetch only, no SDK. Uses the form-encoded REST API with the
 * SECRET key (server-side). Card data never transits here: checkout/portal are
 * PROVIDER-HOSTED, so the user enters card details on Stripe, and we receive only
 * a redirect URL + later webhook references. Live HTTP is pending-live (needs a
 * real key); signature verification + event parsing are fully implemented/tested.
 */
import { verifyWebhookSignature } from './signature';
import {
  WebhookVerificationError,
  type BillingProvider,
  type CheckoutParams,
  type PortalParams,
} from './types';
import type { BillingEvent } from '../types';

const API = 'https://api.stripe.com/v1';

function form(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) usp.set(k, String(v));
  return usp.toString();
}

export class StripeProvider implements BillingProvider {
  readonly name = 'stripe' as const;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  constructor(secretKey: string, webhookSecret: string) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
  }

  private async post(path: string, body: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as Record<string, unknown>;
  }

  async createCheckoutSession(params: CheckoutParams): Promise<{ url: string }> {
    const body = form({
      mode: 'subscription',
      'line_items[0][price]': params.priceId,
      'line_items[0][quantity]': 1,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.clientReferenceId,
      customer: params.providerCustomerId ?? undefined,
      'subscription_data[trial_period_days]': params.trialDays,
      'discounts[0][coupon]': params.couponId,
    });
    const session = await this.post('/checkout/sessions', body);
    return { url: String(session.url) };
  }

  async createPortalSession(params: PortalParams): Promise<{ url: string }> {
    const session = await this.post(
      '/billing_portal/sessions',
      form({ customer: params.providerCustomerId, return_url: params.returnUrl }),
    );
    return { url: String(session.url) };
  }

  constructEvent(payload: string, signatureHeader: string): BillingEvent {
    if (!verifyWebhookSignature(payload, signatureHeader, this.webhookSecret)) {
      throw new WebhookVerificationError();
    }
    const parsed = JSON.parse(payload) as {
      id: string;
      type: string;
      created: number;
      data: { object: Record<string, unknown> };
    };
    return {
      id: parsed.id,
      type: parsed.type,
      createdAt: parsed.created,
      data: parsed.data.object,
    };
  }
}

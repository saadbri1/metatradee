/**
 * Deterministic mock provider — CI + local fallback when no key is configured.
 * No network, no charges. `constructEvent` still enforces signature verification
 * (so idempotency/verification paths are testable end-to-end) but parses a
 * simple JSON body into the normalized event shape.
 */
import { verifyWebhookSignature } from './signature';
import {
  WebhookVerificationError,
  type BillingProvider,
  type CheckoutParams,
  type PortalParams,
} from './types';
import type { BillingEvent } from '../types';

export class MockBillingProvider implements BillingProvider {
  readonly name = 'mock' as const;
  private readonly webhookSecret: string;
  constructor(webhookSecret = 'whsec_mock') {
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(params: CheckoutParams): Promise<{ url: string }> {
    // A fake but well-formed URL; card data is never touched here.
    return {
      url: `https://mock.checkout/local?ref=${encodeURIComponent(params.clientReferenceId)}`,
    };
  }

  async createPortalSession(params: PortalParams): Promise<{ url: string }> {
    return { url: `https://mock.portal/local?c=${encodeURIComponent(params.providerCustomerId)}` };
  }

  constructEvent(payload: string, signatureHeader: string): BillingEvent {
    if (!verifyWebhookSignature(payload, signatureHeader, this.webhookSecret)) {
      throw new WebhookVerificationError();
    }
    const parsed = JSON.parse(payload) as {
      id?: string;
      type?: string;
      created?: number;
      data?: Record<string, unknown>;
    };
    if (!parsed.id || !parsed.type) throw new WebhookVerificationError('Malformed event');
    return {
      id: parsed.id,
      type: parsed.type,
      createdAt: parsed.created ?? Math.floor(Date.now() / 1000),
      data: parsed.data ?? {},
    };
  }
}

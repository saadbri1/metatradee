/**
 * Provider abstraction. Billing logic depends ONLY on this interface — never on
 * a vendor SDK — so Stripe ⇄ Paddle ⇄ mock is a config/adapter swap. The
 * provider is the source of truth for money; adapters never compute charges.
 * No method ever accepts or returns raw card data (tokens/ids only).
 */
import type { BillingEvent } from '../types';

export interface CheckoutParams {
  providerCustomerId: string | null;
  /** Provider Price id (from config, not hardcoded in feature code). */
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  /** Provider-managed coupon/promo id — never a self-computed discount. */
  couponId?: string;
  /** Our user id, echoed back on the resulting subscription for mapping. */
  clientReferenceId: string;
}

export interface PortalParams {
  providerCustomerId: string;
  returnUrl: string;
}

export interface BillingProvider {
  readonly name: 'stripe' | 'paddle' | 'mock';
  /** Provider-hosted checkout — the user enters card data on the PROVIDER only. */
  createCheckoutSession(params: CheckoutParams): Promise<{ url: string }>;
  /** Provider-hosted customer portal (update card, invoices) — hosted by provider. */
  createPortalSession(params: PortalParams): Promise<{ url: string }>;
  /** Verify signature + parse a raw webhook into a normalized event, or throw. */
  constructEvent(payload: string, signatureHeader: string): BillingEvent;
}

export class WebhookVerificationError extends Error {
  constructor(message = 'Invalid webhook signature') {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

/**
 * Billing domain types. Everything money-related MIRRORS the provider — the app
 * never computes charges/proration/tax. We store only provider REFERENCES
 * (customer/subscription/invoice ids) and mirrored status; NEVER card data.
 */
import type { PlanFeatures, PlanLimits, PlanTier } from './plans';

/** Provider-mirrored subscription statuses (Stripe-aligned). */
export type SubscriptionStatus =
  'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid';

/** The mirrored subscription row the app reads for gating (no money math). */
export interface MirroredSubscription {
  tier: PlanTier;
  status: SubscriptionStatus;
  /** ISO. Access continues until here even after cancel/at-period-end. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

/** Resolved, server-authoritative capabilities delivered to the client read-only. */
export interface Entitlement {
  tier: PlanTier;
  features: PlanFeatures;
  limits: PlanLimits;
  status: SubscriptionStatus | 'none';
  /** True while in the dunning grace window (past_due but still granted). */
  inGracePeriod: boolean;
  /** True when access is scheduled to end (cancel at period end). */
  endingAt: string | null;
}

export interface Invoice {
  providerInvoiceId: string;
  number: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

/** A normalized provider webhook event (adapter output). */
export interface BillingEvent {
  id: string;
  type: string;
  createdAt: number;
  data: Record<string, unknown>;
}

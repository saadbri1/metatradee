/**
 * PayPal → MetaTradee mapping. PURE: no network, no database, fully unit
 * testable. The webhook route and the post-approval verification both funnel
 * through this, so "what does this PayPal state mean" is answered in one place.
 *
 * The central rule: only an authoritative ACTIVE subscription on a RECOGNISED
 * plan id grants a paid tier. Everything else resolves to Free.
 */
import type { PlanTier } from '../../plans';
import type { SubscriptionStatus, MirroredSubscription } from '../../types';
import type { BillingInterval } from '../../pricing';

/** PayPal subscription statuses we may receive. */
export type PayPalStatus =
  'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

/**
 * Map a PayPal status onto the mirrored status the resolver already
 * understands. Reusing the existing vocabulary means the entitlement resolver
 * needs no PayPal-specific branch — one authority, one set of rules.
 *
 *   APPROVAL_PENDING / APPROVED  the user has not completed payment, or PayPal
 *                                has not activated it yet → `incomplete`,
 *                                which the resolver already treats as Free.
 *                                Crucially this means an approval callback
 *                                alone never unlocks anything.
 *   ACTIVE                       → `active`
 *   SUSPENDED                    → `past_due`: payments are failing but PayPal
 *                                may still recover it, matching the dunning
 *                                grace the resolver already implements.
 *   CANCELLED                    → `canceled`: access continues to the end of
 *                                the paid period, then Free.
 *   EXPIRED                      → `canceled` with the period already over,
 *                                so the resolver lands on Free immediately.
 */
export function mapStatus(status: string): SubscriptionStatus | null {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'APPROVAL_PENDING':
    case 'APPROVED':
      return 'incomplete';
    case 'SUSPENDED':
      return 'past_due';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'canceled';
    default:
      // An unknown status must not be guessed.
      return null;
  }
}

/** True only for the one status that may unlock a paid plan. */
export function grantsAccess(status: string): boolean {
  return status === 'ACTIVE';
}

/**
 * Webhook event types we act on. Anything else is acknowledged and ignored —
 * an unrecognised event must never be an error the sender retries forever.
 */
export const HANDLED_EVENTS = [
  'BILLING.SUBSCRIPTION.CREATED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.REFUNDED',
] as const;

export type HandledEvent = (typeof HANDLED_EVENTS)[number];

export function isHandledEvent(type: string): type is HandledEvent {
  return (HANDLED_EVENTS as readonly string[]).includes(type);
}

/**
 * Events that must NEVER grant access on their own, regardless of the status
 * inside them.
 *
 * CREATED fires the moment a subscription object exists — before the buyer has
 * paid anything. Treating it as a grant is the classic PayPal integration bug.
 * The resulting mirror row is written with an unpaid status so the record
 * exists, but the resolver reads it as Free.
 */
export const NEVER_GRANTS: readonly string[] = ['BILLING.SUBSCRIPTION.CREATED'];

export interface PayPalResource {
  id?: string;
  plan_id?: string;
  status?: string;
  custom_id?: string;
  start_time?: string;
  billing_agreement_id?: string;
  billing_info?: { next_billing_time?: string };
}

export interface PayPalInterpretation {
  /** 'subscription' updates the mirror; 'ignore' is acknowledged and dropped. */
  kind: 'subscription' | 'ignore';
  /** Our user id, carried as `custom_id`. */
  userId: string | null;
  paypalSubscriptionId: string | null;
  paypalPlanId: string | null;
  subscription?: MirroredSubscription;
  /** Set when the plan id is not one of ours — surfaced for review. */
  unknownPlanId?: boolean;
  reason?: string;
}

export interface InterpretOptions {
  /** Resolves a PayPal plan id to our tier + interval; null when unrecognised. */
  resolvePlan: (paypalPlanId: string | null | undefined) => {
    tier: PlanTier;
    interval: BillingInterval;
  } | null;
}

/**
 * Map a verified PayPal event to a mirror update.
 *
 * `resource` MUST come from a server-side read of the subscription (or a
 * signature-verified webhook body) — never from the browser.
 */
export function interpretPayPalEvent(
  eventType: string,
  resource: PayPalResource,
  opts: InterpretOptions,
): PayPalInterpretation {
  const userId = resource.custom_id ?? null;
  const subscriptionId = resource.id ?? resource.billing_agreement_id ?? null;
  const planId = resource.plan_id ?? null;

  if (!isHandledEvent(eventType)) {
    return {
      kind: 'ignore',
      userId,
      paypalSubscriptionId: subscriptionId,
      paypalPlanId: planId,
      reason: 'unhandled event type',
    };
  }

  // A sale event carries no plan; it confirms money moved but the subscription
  // read is what establishes the plan. Acknowledged, not acted on here.
  if (eventType === 'PAYMENT.SALE.COMPLETED' || eventType === 'PAYMENT.SALE.REFUNDED') {
    return {
      kind: 'ignore',
      userId,
      paypalSubscriptionId: subscriptionId,
      paypalPlanId: planId,
      reason: 'sale event — subscription state is authoritative',
    };
  }

  if (!userId || !subscriptionId) {
    return {
      kind: 'ignore',
      userId,
      paypalSubscriptionId: subscriptionId,
      paypalPlanId: planId,
      reason: 'missing custom_id or subscription id',
    };
  }

  const binding = opts.resolvePlan(planId);
  if (!binding) {
    // Unknown plan id → Free, and flagged. Never guess a tier from a price.
    return {
      kind: 'subscription',
      userId,
      paypalSubscriptionId: subscriptionId,
      paypalPlanId: planId,
      unknownPlanId: true,
      subscription: {
        tier: 'free',
        status: 'incomplete',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEnd: null,
      },
      reason: 'unrecognised PayPal plan id',
    };
  }

  // PAYMENT.FAILED has no status of its own — it means dunning.
  const rawStatus =
    eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'
      ? 'SUSPENDED'
      : (resource.status ?? statusFromEventType(eventType));

  const mapped = mapStatus(rawStatus ?? '');
  if (!mapped) {
    return {
      kind: 'ignore',
      userId,
      paypalSubscriptionId: subscriptionId,
      paypalPlanId: planId,
      reason: `unknown PayPal status: ${rawStatus}`,
    };
  }

  // CREATED never grants, whatever the status field claims.
  const status: SubscriptionStatus = NEVER_GRANTS.includes(eventType) ? 'incomplete' : mapped;
  const grants = status === 'active';

  return {
    kind: 'subscription',
    userId,
    paypalSubscriptionId: subscriptionId,
    paypalPlanId: planId,
    subscription: {
      // Tier is only carried when the state actually grants it; otherwise the
      // mirror records Free so a stale row can never leave access behind.
      tier: grants ? binding.tier : 'free',
      status,
      currentPeriodEnd: resource.billing_info?.next_billing_time ?? null,
      cancelAtPeriodEnd: rawStatus === 'CANCELLED',
      trialEnd: null,
    },
  };
}

/** Some events omit `status`; derive it from the event name. */
function statusFromEventType(eventType: string): string | null {
  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
      return 'ACTIVE';
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      return 'SUSPENDED';
    case 'BILLING.SUBSCRIPTION.CANCELLED':
      return 'CANCELLED';
    case 'BILLING.SUBSCRIPTION.EXPIRED':
      return 'EXPIRED';
    case 'BILLING.SUBSCRIPTION.CREATED':
      return 'APPROVAL_PENDING';
    default:
      return null;
  }
}

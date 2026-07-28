/**
 * Typed entitlement failure. Thrown by server guards so a route handler or an
 * action can answer with a real 403 instead of a generic 500, and so callers can
 * discriminate "you may not" from "it broke".
 *
 * The message is upsell copy shown to the user: it names the gated capability
 * and the plan that includes it, and never leaks subscription internals
 * (provider ids, customer ids, price ids, status history).
 */
import type { PlanFeatures, PlanTier } from './plans';

export const ENTITLEMENT_REQUIRED = 'entitlement_required' as const;

export class EntitlementError extends Error {
  readonly code = ENTITLEMENT_REQUIRED;
  /** HTTP status a route handler should answer with. */
  readonly status = 403;
  readonly feature: keyof PlanFeatures;
  /** Cheapest tier that grants it, or null when nothing grants it yet. */
  readonly requiredTier: PlanTier | null;

  constructor(feature: keyof PlanFeatures, requiredTier: PlanTier | null, message: string) {
    super(message);
    this.name = 'EntitlementError';
    this.feature = feature;
    this.requiredTier = requiredTier;
  }
}

export function isEntitlementError(e: unknown): e is EntitlementError {
  return e instanceof EntitlementError;
}

/** Safe JSON body for a 403 response. Contains no subscription internals. */
export function entitlementErrorBody(e: EntitlementError) {
  return {
    error: e.code,
    feature: e.feature,
    requiredTier: e.requiredTier,
    message: e.message,
  };
}

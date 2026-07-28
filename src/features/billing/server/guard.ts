/**
 * Page-level entitlement guards for Server Components.
 *
 * Until now only *actions* were gated, so a Free user could open `/ai-coach` or
 * `/journal/import` by typing the URL and get the full premium component tree —
 * every button dead. These guards resolve the entitlement on the server BEFORE
 * the page renders, so gated markup is never sent to a browser that may not
 * have it.
 *
 * Server-authoritative and fail-closed: an unresolved subscription is Free, and
 * anything unexpected during resolution denies rather than grants.
 */
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/features/auth/server/session';
import { getEntitlement } from './queries';
import { hasFeature } from '../entitlements';
import { minimumPlanNameFor, minimumTierFor } from '../access';
import { EntitlementError } from '../errors';
import type { PlanFeatures } from '../plans';
import type { Entitlement } from '../types';

/** The signed-in viewer's authoritative entitlement. */
export async function getViewerEntitlement(): Promise<Entitlement> {
  const user = await requireAuth();
  const supabase = await createClient();
  return getEntitlement(supabase, user.id);
}

export interface FeatureAccess {
  allowed: boolean;
  entitlement: Entitlement;
}

/**
 * Resolve access without throwing, so a page can render a locked state in place
 * of its content — the user keeps the navigation and gets an upgrade path
 * instead of a dead end or a confusing redirect.
 */
export async function checkFeatureAccess(feature: keyof PlanFeatures): Promise<FeatureAccess> {
  const entitlement = await getViewerEntitlement();
  return { allowed: hasFeature(entitlement, feature), entitlement };
}

/** Upsell copy naming the cheapest tier that genuinely includes the feature. */
export function upgradeMessageFor(feature: keyof PlanFeatures): string {
  const plan = minimumPlanNameFor(feature);
  return plan
    ? `Your plan does not include this. It is available on ${plan} and above.`
    : 'This capability is not available yet.';
}

/**
 * Throw a typed 403 unless the viewer is entitled. For route handlers and
 * anywhere a locked *render* is not the right answer.
 */
export async function requireFeature(feature: keyof PlanFeatures): Promise<Entitlement> {
  const { allowed, entitlement } = await checkFeatureAccess(feature);
  if (!allowed) {
    throw new EntitlementError(feature, minimumTierFor(feature), upgradeMessageFor(feature));
  }
  return entitlement;
}

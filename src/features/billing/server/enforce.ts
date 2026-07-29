/**
 * Server-side gate helpers. Feature server actions call these to enforce plan
 * limits/features AUTHORITATIVELY (the client UI merely reflects access). Both
 * fail closed: an unresolved entitlement is Free, so an over-limit action is
 * rejected — e.g. creating the 51st trade on Free is denied by the server, not
 * just hidden in the UI. Existing feature data is never touched; only new,
 * over-limit additions are blocked with an upgrade path.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEntitlement } from './queries';
import { checkLimit, hasFeature } from '../entitlements';
import { minimumTierFor } from '../access';
import { ENTITLEMENT_REQUIRED } from '../errors';
import { PLANS, type PlanFeatures, type PlanLimits, type PlanTier } from '../plans';
import type { Entitlement } from '../types';

export const LIMIT_REACHED = 'limit_reached' as const;

/**
 * A refusal, in a shape a caller can BRANCH on rather than string-match.
 *
 * Denials used to be a bare `{ ok: false, error: string }`, which a client
 * cannot distinguish from a validation failure or an outage — so it could not
 * reliably show an upgrade path. This carries the reason, the exact gated
 * value, and the cheapest tier that would grant it.
 *
 * It deliberately contains NO subscription internals (no provider, customer,
 * subscription or price ids), because it is returned to the browser.
 */
export interface EntitlementDenial {
  code: typeof ENTITLEMENT_REQUIRED | typeof LIMIT_REACHED;
  /** The HTTP status a route handler should answer with. */
  status: 403;
  /** Set when a capability was missing. */
  feature?: keyof PlanFeatures;
  /** Set when a numeric limit was reached. */
  limit?: keyof PlanLimits;
  /** Cheapest tier that grants it, or null when nothing grants it yet. */
  requiredTier: PlanTier | null;
  currentTier: PlanTier;
  message: string;
}

export interface GateResult {
  ok: boolean;
  /** Upsell reason (names the gated value) when blocked; null when allowed. */
  reason: string | null;
  /** Typed 403 payload when blocked; null when allowed. */
  denial: EntitlementDenial | null;
  entitlement: Entitlement;
}

/**
 * Convert a blocked gate into an action result. Every gated server action
 * returns this, so a denial is always typed and always carries an upgrade path.
 */
export function denied(gate: GateResult): {
  ok: false;
  error: string;
  entitlement: EntitlementDenial;
} {
  if (gate.denial === null) {
    // Programmer error: denied() called on an allowed gate. Fail closed.
    throw new Error('denied() called on a gate that was not blocked');
  }
  return { ok: false, error: gate.denial.message, entitlement: gate.denial };
}

function featureDenial(
  feature: keyof PlanFeatures,
  entitlement: Entitlement,
  message: string,
): EntitlementDenial {
  return {
    code: ENTITLEMENT_REQUIRED,
    status: 403,
    feature,
    requiredTier: minimumTierFor(feature),
    currentTier: entitlement.tier,
    message,
  };
}

function limitDenial(
  limit: keyof PlanLimits,
  entitlement: Entitlement,
  message: string,
): EntitlementDenial {
  // The cheapest tier that raises this limit above the current one.
  return {
    code: LIMIT_REACHED,
    status: 403,
    limit,
    requiredTier: nextTierRaising(limit, entitlement),
    currentTier: entitlement.tier,
    message,
  };
}

/** The cheapest tier whose cap for `limit` exceeds the viewer's current cap. */
function nextTierRaising(limit: keyof PlanLimits, entitlement: Entitlement): PlanTier | null {
  const current = entitlement.limits[limit];
  if (current === null) return null;
  const order: PlanTier[] = ['free', 'trader', 'pro', 'funded'];
  for (const tier of order) {
    const cap = PLANS[tier].limits[limit];
    if (cap === null || cap > current) return tier;
  }
  return null;
}

/** Assert the user may add one more of a limited resource. */
export async function assertWithinLimit(
  supabase: SupabaseClient,
  userId: string,
  key: keyof Entitlement['limits'],
  currentCount: number,
): Promise<GateResult> {
  const entitlement = await getEntitlement(supabase, userId);
  const check = checkLimit(entitlement, key, currentCount);
  const reason = check.reason;
  return {
    ok: check.allowed,
    reason,
    denial: check.allowed ? null : limitDenial(key, entitlement, reason ?? 'Plan limit reached.'),
    entitlement,
  };
}

/**
 * Count what the user already owns and assert they may add one more.
 *
 * Four numeric limits (accounts, playbooks, reports/month, AI reviews/month)
 * were declared in the plan matrix but enforced nowhere, so a Free account
 * could create them without bound. This is the single place that pattern lives,
 * so a new limited resource cannot quietly ship without a gate.
 *
 * Fails CLOSED: if the count cannot be read, the request is refused rather than
 * allowed, because an unknown count must not be treated as zero.
 */
export async function assertCanAdd(
  supabase: SupabaseClient,
  userId: string,
  key: keyof Entitlement['limits'],
  table: string,
  opts: { softDeleted?: boolean; since?: Date } = {},
): Promise<GateResult> {
  const entitlement = await getEntitlement(supabase, userId);
  if (entitlement.limits[key] === null) {
    return { ok: true, reason: null, denial: null, entitlement };
  }

  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (opts.softDeleted) query = query.is('deleted_at', null);
  if (opts.since) query = query.gte('created_at', opts.since.toISOString());

  const { count, error } = await query;
  if (error) {
    const message = 'Could not verify your plan usage. Please try again.';
    return {
      ok: false,
      reason: message,
      denial: limitDenial(key, entitlement, message),
      entitlement,
    };
  }

  const check = checkLimit(entitlement, key, count ?? 0);
  return {
    ok: check.allowed,
    reason: check.reason,
    denial: check.allowed
      ? null
      : limitDenial(key, entitlement, check.reason ?? 'Plan limit reached.'),
    entitlement,
  };
}

/** Start of the current UTC month — the window monthly limits are counted over. */
export function startOfMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Assert the user's plan includes a feature (fail-closed). */
export async function assertFeature(
  supabase: SupabaseClient,
  userId: string,
  feature: keyof Entitlement['features'],
): Promise<GateResult> {
  const entitlement = await getEntitlement(supabase, userId);
  const ok = hasFeature(entitlement, feature);
  if (ok) return { ok: true, reason: null, denial: null, entitlement };
  const plan = minimumTierFor(feature);
  const message = plan
    ? `Your plan does not include this. It is available on ${PLANS[plan].name} and above.`
    : 'This capability is not available yet.';
  return {
    ok: false,
    reason: message,
    denial: featureDenial(feature, entitlement, message),
    entitlement,
  };
}

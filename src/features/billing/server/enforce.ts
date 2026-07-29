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
import type { Entitlement } from '../types';

export interface GateResult {
  ok: boolean;
  /** Upsell reason (names the gated value) when blocked; null when allowed. */
  reason: string | null;
  entitlement: Entitlement;
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
  return { ok: check.allowed, reason: check.reason, entitlement };
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
    return { ok: true, reason: null, entitlement };
  }

  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (opts.softDeleted) query = query.is('deleted_at', null);
  if (opts.since) query = query.gte('created_at', opts.since.toISOString());

  const { count, error } = await query;
  if (error) {
    return {
      ok: false,
      reason: 'Could not verify your plan usage. Please try again.',
      entitlement,
    };
  }

  const check = checkLimit(entitlement, key, count ?? 0);
  return { ok: check.allowed, reason: check.reason, entitlement };
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
  return {
    ok,
    reason: ok ? null : `This is a paid feature. Upgrade to unlock ${feature}.`,
    entitlement,
  };
}

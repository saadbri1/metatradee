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

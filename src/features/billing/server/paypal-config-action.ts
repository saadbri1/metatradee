'use server';

/**
 * What the browser is allowed to know about PayPal: the PUBLIC client id, and
 * which tier/interval combinations are actually purchasable.
 *
 * Plan ids are resolved HERE rather than in a component, so a component never
 * holds one and a tampered client cannot substitute a cheaper plan — the server
 * looks up the plan id for the tier it was asked for, and verification later
 * re-checks that PayPal agrees.
 */
import { env as publicEnv } from '@/config/env';
import { isPayPalConfigured } from '../providers/paypal/client';
import { paypalPlanIdFor, isPlanMapComplete } from '../providers/paypal/plan-map';
import type { BillingInterval } from '../pricing';
import type { PlanTier } from '../plans';

export interface PayPalCheckoutConfig {
  /** True only when credentials AND all six plan ids are present. */
  available: boolean;
  clientId: string | null;
  environment: 'sandbox' | 'live';
}

export async function getPayPalCheckoutConfigAction(): Promise<PayPalCheckoutConfig> {
  const clientId = publicEnv.NEXT_PUBLIC_PAYPAL_CLIENT_ID || null;
  const available = isPayPalConfigured() && isPlanMapComplete() && !!clientId;
  return {
    available,
    clientId: available ? clientId : null,
    environment: process.env.PAYPAL_ENVIRONMENT === 'live' ? 'live' : 'sandbox',
  };
}

/**
 * The PayPal plan id for a tier + interval. Returns null rather than guessing,
 * and never exposes the whole map.
 */
export async function getPayPalPlanIdAction(
  tier: PlanTier,
  interval: BillingInterval,
): Promise<string | null> {
  if (!isPayPalConfigured()) return null;
  return paypalPlanIdFor(tier, interval);
}

/**
 * The authenticated user id, used as PayPal's `custom_id` so the subscription
 * carries its owner.
 *
 * Returning it to the browser is safe: the server re-reads custom_id from
 * PayPal during verification and refuses any subscription whose owner is not
 * the caller, so a tampered value fails verification rather than granting
 * anything.
 */
export async function getCheckoutIdentityAction(): Promise<string | null> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

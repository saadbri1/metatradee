'use server';

/**
 * Post-approval verification.
 *
 * The browser hands us ONE thing: a subscription id. Everything else — plan,
 * price, status, billing interval, owner — is read back from PayPal server-side.
 * Nothing the client says about what it bought is trusted, because a client can
 * say anything.
 *
 * This action never grants access by itself either. It writes the mirror from
 * PayPal's authoritative answer, and the existing entitlement resolver decides
 * what that means. An APPROVAL_PENDING subscription therefore resolves to Free
 * even though the PayPal button reported "success".
 */
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSubscription, isPayPalConfigured } from './client';
import { bindingForPaypalPlanId, bindingMatches } from './plan-map';
import { interpretPayPalEvent } from './interpret';
import {
  PAYPAL_SUBSCRIPTIONS_ENABLED,
  SUBSCRIPTIONS_RETIRED_MESSAGE,
} from './subscriptions-disabled';
// TEMPORARY — remove with diagnostics.ts after the sandbox test.
import { ppDiag, diag } from './diagnostics';
import type { BillingInterval } from '../../pricing';
import type { PlanTier } from '../../plans';

export type VerifyOutcome =
  | 'retired'
  | 'active'
  | 'already_subscribed'
  | 'pending'
  | 'not_configured'
  | 'unauthenticated'
  | 'not_yours'
  | 'plan_mismatch'
  | 'unknown_plan'
  | 'error';

export interface VerifyResult {
  ok: boolean;
  outcome: VerifyOutcome;
  /** Only set once PayPal itself reports ACTIVE on a plan we recognise. */
  tier?: PlanTier;
  message: string;
}

/**
 * Verify a subscription the user just approved, and mirror it.
 *
 * @param subscriptionId  PayPal subscription id from the button callback.
 * @param expectedTier    What the UI believed it was selling — checked, not used.
 * @param expectedInterval Same.
 */
export async function verifyPayPalSubscriptionAction(
  subscriptionId: string,
  expectedTier: PlanTier,
  expectedInterval: BillingInterval,
): Promise<VerifyResult> {
  /*
   * RETIRED. Checked FIRST — before auth, before config, before any PayPal
   * call — so there is no ordering in which this path can still mirror a
   * subscription or grant a tier.
   */
  if (!PAYPAL_SUBSCRIPTIONS_ENABLED) {
    return { ok: false, outcome: 'retired', message: SUBSCRIPTIONS_RETIRED_MESSAGE };
  }

  if (!isPayPalConfigured()) {
    return {
      ok: false,
      outcome: 'not_configured',
      message: 'PayPal is not configured, so no subscription can be confirmed.',
    };
  }

  // Authentication first — an anonymous caller may not confirm anything.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, outcome: 'unauthenticated', message: 'You must be signed in.' };
  }

  if (typeof subscriptionId !== 'string' || !/^I-[A-Z0-9]{6,30}$/.test(subscriptionId)) {
    return { ok: false, outcome: 'error', message: 'That subscription reference is not valid.' };
  }

  let subscription;
  try {
    subscription = await getSubscription(subscriptionId);
  } catch {
    // Never surface PayPal's raw error — it can carry account detail.
    return {
      ok: false,
      outcome: 'error',
      message: 'We could not confirm this subscription with PayPal. Please try again shortly.',
    };
  }

  ppDiag('verify.read', {
    subscription: diag.subscriptionId(subscription.id),
    paypalStatus: subscription.status ?? null,
    planId: diag.subscriptionId(subscription.plan_id),
  });

  /*
   * OWNERSHIP. custom_id was set to the user id when the subscription was
   * created. If it does not match the caller, someone is trying to claim
   * another person's subscription — refuse, and mirror nothing.
   */
  const ownerMatches = subscription.custom_id === user.id;
  ppDiag('verify.ownership', {
    subscription: diag.subscriptionId(subscription.id),
    // The RESULT, plus truncated prefixes so a mismatch can be diagnosed
    // without putting either full identifier in a log.
    customIdMatch: ownerMatches,
    customIdPrefix: diag.userId(subscription.custom_id),
    callerPrefix: diag.userId(user.id),
  });
  if (!ownerMatches) {
    return {
      ok: false,
      outcome: 'not_yours',
      message: 'That subscription does not belong to this account.',
    };
  }

  // The plan PayPal reports must be one of ours...
  const binding = bindingForPaypalPlanId(subscription.plan_id);
  if (!binding) {
    return {
      ok: false,
      outcome: 'unknown_plan',
      message: 'That plan is not recognised. Nothing has been charged to your account here.',
    };
  }

  // ...and must be the exact plan for the tier + interval the UI offered.
  if (!bindingMatches(expectedTier, expectedInterval, subscription.plan_id)) {
    return {
      ok: false,
      outcome: 'plan_mismatch',
      message: 'The approved plan does not match the plan you selected.',
    };
  }

  /*
   * Reuse the same interpreter the webhook uses, so a subscription confirmed
   * here and one confirmed by webhook can never be graded differently.
   */
  const interpreted = interpretPayPalEvent(
    'BILLING.SUBSCRIPTION.UPDATED',
    {
      id: subscription.id,
      plan_id: subscription.plan_id,
      status: subscription.status,
      custom_id: subscription.custom_id,
      billing_info: subscription.billing_info,
    },
    {
      resolvePlan: (planId) => {
        const b = bindingForPaypalPlanId(planId);
        return b ? { tier: b.tier, interval: b.interval } : null;
      },
    },
  );

  if (interpreted.kind !== 'subscription' || !interpreted.subscription) {
    return {
      ok: false,
      outcome: 'error',
      message: 'PayPal returned a state we do not recognise. Nothing has been changed.',
    };
  }

  const mirrored = interpreted.subscription;

  /*
   * DOUBLE-BILLING GUARD.
   *
   * PayPal has no notion of "switching plan" through a new checkout: approving
   * a second plan creates a SECOND subscription and the first keeps billing.
   * Upserting on user_id would move our mirror to the new tier while the buyer
   * silently paid for both. So if a DIFFERENT subscription is already on file
   * and still granting access, refuse — the existing one must be cancelled (or
   * revised at PayPal) first.
   */
  const service = createServiceClient();
  const { data: onFile } = await service
    .from('billing_subscriptions')
    .select('provider_subscription_id, status')
    .eq('user_id', user.id)
    .maybeSingle();
  const existing = onFile as { provider_subscription_id: string | null; status: string } | null;
  if (
    existing?.provider_subscription_id &&
    existing.provider_subscription_id !== subscription.id &&
    ['active', 'past_due', 'trialing'].includes(existing.status)
  ) {
    return {
      ok: false,
      outcome: 'already_subscribed',
      message:
        'You already have an active PayPal subscription. Cancel it in PayPal before starting a different plan, otherwise both would be billed.',
    };
  }

  const { error } = await service.from('billing_subscriptions').upsert(
    {
      user_id: user.id,
      provider_subscription_id: subscription.id,
      tier: mirrored.tier,
      status: mirrored.status,
      current_period_end: mirrored.currentPeriodEnd,
      cancel_at_period_end: mirrored.cancelAtPeriodEnd,
      trial_end: mirrored.trialEnd,
      // Deliberately NOT bumped: only webhooks advance the ordering clock, so
      // this write can never make a later webhook look stale.
      last_event_at: 0,
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    return {
      ok: false,
      outcome: 'error',
      message: 'We confirmed your subscription but could not save it. Please refresh.',
    };
  }

  ppDiag('verify.result', {
    subscription: diag.subscriptionId(subscription.id),
    paypalStatus: subscription.status ?? null,
    mirroredStatus: mirrored.status,
    resultingTier: mirrored.tier,
    outcome: mirrored.status === 'active' ? 'active' : 'pending',
  });

  if (mirrored.status === 'active') {
    return {
      ok: true,
      outcome: 'active',
      tier: mirrored.tier,
      message: 'Your subscription is active.',
    };
  }

  /*
   * PayPal often returns APPROVAL_PENDING/APPROVED for a short window after the
   * buyer approves. That is NOT access — say so plainly rather than showing a
   * success state that the app will then contradict.
   */
  return {
    ok: true,
    outcome: 'pending',
    message:
      'PayPal has your approval but has not activated the subscription yet. This usually takes a few moments — your plan updates automatically once it does.',
  };
}

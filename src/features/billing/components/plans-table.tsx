'use client';

/**
 * In-app plan comparison and checkout entry points.
 *
 * Prices come from the central pricing config — the same values the public
 * pricing page shows, so a user cannot be quoted one price on the marketing
 * site and another after signing in. The provider remains authoritative for
 * what is actually charged.
 *
 * Downgrades are not hidden. A cheaper plan is offered as plainly as a dearer
 * one, and the current plan is stated rather than disguised as unavailable.
 */
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS, PAID_TIERS, type PlanFeatures, type PlanTier } from '../plans';
import {
  getCheckoutIdentityAction,
  getPayPalCheckoutConfigAction,
  getPayPalPlanIdAction,
} from '../server/paypal-config-action';
import { PAYPAL_SUBSCRIPTIONS_ENABLED } from '../providers/paypal/subscriptions-disabled';
import {
  ANNUAL_LABEL,
  RECOMMENDED_TIER,
  TIER_ORDER,
  amountFor,
  annualSavingPercent,
  formatPrice,
  isFree,
  monthlyEquivalent,
  priceFor,
  type BillingInterval,
} from '../pricing';

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  advancedAnalytics: 'Advanced analytics',
  brokerImport: 'Broker import',
  playbookAdvanced: 'Playbook versioning & adherence',
  tradeReplay: 'Bar-by-bar trade replay',
  aiCoach: 'AI Coach',
  reportsExport: 'Report export',
  reportSharing: 'Shareable report links',
  propFirmTools: 'Prop-firm tools',
};

export function PlansTable({
  currentTier,
  checkoutUnavailable = false,
  onSubscribed: _onSubscribed,
}: {
  currentTier?: PlanTier;
  /**
   * Was called once PayPal reported an ACTIVE subscription. Unused while the
   * subscription path is retired; the Orders slice will re-wire it to fire on a
   * verified COMPLETED capture.
   */
  onSubscribed?: () => void;
  /**
   * No live payment provider is configured. Checkout would hand the user a
   * placeholder URL that goes nowhere, so the control is disabled and says so
   * rather than pretending to start a purchase.
   */
  checkoutUnavailable?: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const annual = interval === 'annual';
  const [paypal, setPaypal] = useState<{
    available: boolean;
    clientId: string | null;
    environment: 'sandbox' | 'live';
  } | null>(null);
  // Plan ids are fetched per tier+interval from the server; a component never
  // holds the map, so a tampered client cannot swap in a cheaper plan.
  const [planIds, setPlanIds] = useState<Record<string, string | null>>({});
  // Sent to PayPal as custom_id so the subscription carries its owner. The
  // server re-reads it from PayPal and refuses a mismatch, so this is an
  // identifier, not a trust boundary.
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPayPalCheckoutConfigAction().then((cfg) => {
      if (!cancelled) setPaypal(cfg);
    });
    getCheckoutIdentityAction().then((id) => {
      if (!cancelled) setUserId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!paypal?.available) return;
    let cancelled = false;
    for (const tier of PAID_TIERS) {
      const key = `${tier}:${interval}`;
      if (key in planIds) continue;
      void getPayPalPlanIdAction(tier, interval).then((id) => {
        if (!cancelled) setPlanIds((prev) => ({ ...prev, [key]: id }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [paypal?.available, interval, planIds]);

  // Without a user id there is no owner to bind the subscription to, so the
  // button must not render at all.
  /*
   * The subscription button is retired and must not render. Orders checkout
   * replaces it; until that lands the CTA states the truth rather than
   * offering a control that would create a subscription.
   */
  const paypalReady = false as boolean;
  void PAYPAL_SUBSCRIPTIONS_ENABLED;
  void userId;

  /**
   * One place decides what a paid tier's call-to-action is, so the disabled and
   * live paths cannot drift. Order matters: current plan first, then the
   * honest "not available" state, then a real PayPal button.
   */
  function renderCta(tier: PlanTier) {
    const isCurrent = currentTier === tier;
    if (isCurrent) {
      return (
        <Button className="w-full" disabled>
          Current plan
        </Button>
      );
    }
    /*
     * Same reason as the server guard: approving a second PayPal plan creates a
     * second subscription and bills both. Offer nothing rather than a control
     * that would cost the user money twice.
     */
    if (currentTier && currentTier !== 'free' && !isCurrent) {
      return (
        <div className="space-y-1.5">
          <Button className="w-full" disabled>
            Cancel current plan first
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            PayPal bills each subscription separately, so your current plan must end before you
            start another.
          </p>
        </div>
      );
    }
    if (checkoutUnavailable || !paypalReady) {
      return (
        <Button className="w-full" disabled>
          Not available yet
        </Button>
      );
    }
    const planId = planIds[`${tier}:${interval}`];
    if (planId === undefined) {
      return (
        <Button className="w-full" disabled>
          Loading…
        </Button>
      );
    }
    if (planId === null) {
      // Configured overall, but this specific combination is not sellable.
      return (
        <Button className="w-full" disabled>
          Not available yet
        </Button>
      );
    }
    return (
      <Button className="w-full" disabled>
        Not available yet
      </Button>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2" role="group" aria-label="Billing interval">
          <Button
            size="sm"
            variant={annual ? 'outline' : 'default'}
            aria-pressed={!annual}
            onClick={() => setInterval('monthly')}
          >
            Monthly
          </Button>
          <Button
            size="sm"
            variant={annual ? 'default' : 'outline'}
            aria-pressed={annual}
            onClick={() => setInterval('annual')}
          >
            Yearly
          </Button>
        </div>
        <p className="text-sm font-medium text-primary">{ANNUAL_LABEL}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const plan = PLANS[tier];
          const price = priceFor(tier);
          const free = isFree(tier);
          const isCurrent = currentTier === tier;
          const enabled = (Object.keys(plan.features) as (keyof PlanFeatures)[]).filter(
            (key) => plan.features[key],
          );
          return (
            <Card
              key={tier}
              aria-label={`${plan.name} plan`}
              className={isCurrent ? 'border-primary' : ''}
            >
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  {plan.name}
                  {isCurrent ? <Badge>Current</Badge> : null}
                  {!isCurrent && tier === RECOMMENDED_TIER ? (
                    <Badge variant="outline">Recommended</Badge>
                  ) : null}
                </CardTitle>
                <p className="text-2xl font-semibold tabular-nums">
                  {free ? 'Free' : formatPrice(annual ? monthlyEquivalent(tier) : price.monthly)}
                  {!free ? (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span>
                  ) : null}
                </p>
                <p className="min-h-[1rem] text-xs text-muted-foreground">
                  {free
                    ? 'No card required'
                    : annual
                      ? `${formatPrice(price.annual)} billed yearly — save ${annualSavingPercent(tier)}%`
                      : `${plan.trialDays}-day free trial`}
                </p>
              </CardHeader>

              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-sm">
                  <li className="text-muted-foreground">
                    {plan.limits.maxTrades === null
                      ? 'Unlimited trades'
                      : `${plan.limits.maxTrades.toLocaleString('en-US')} trades`}
                  </li>
                  {enabled.map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span>{FEATURE_LABELS[key]}</span>
                    </li>
                  ))}
                </ul>

                {PAID_TIERS.includes(tier) ? renderCta(tier) : null}

                {!free && !isCurrent ? (
                  <p className="text-center text-xs text-muted-foreground">
                    {formatPrice(amountFor(tier, interval))} {annual ? 'per year' : 'per month'}.
                    Cancel any time.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {paypal?.available && paypal.environment === 'sandbox' ? (
        <p className="text-xs text-muted-foreground">
          PayPal <span className="font-medium text-foreground">Sandbox</span> — payments here are
          simulated and no real money moves.
        </p>
      ) : null}
    </div>
  );
}

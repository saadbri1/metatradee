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
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS, PAID_TIERS, TIER_RANK, type PlanFeatures, type PlanTier } from '../plans';
import { useCheckout } from '../hooks';
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
}: {
  currentTier?: PlanTier;
  /**
   * No live payment provider is configured. Checkout would hand the user a
   * placeholder URL that goes nowhere, so the control is disabled and says so
   * rather than pretending to start a purchase.
   */
  checkoutUnavailable?: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const checkout = useCheckout();
  const annual = interval === 'annual';

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
          const isDowngrade =
            currentTier !== undefined && TIER_RANK[tier] < TIER_RANK[currentTier] && !free;

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

                {PAID_TIERS.includes(tier) ? (
                  <Button
                    className="w-full"
                    variant={isDowngrade ? 'outline' : 'default'}
                    disabled={isCurrent || checkout.isPending || checkoutUnavailable}
                    onClick={() =>
                      checkout.mutate({ tier: tier as 'trader' | 'pro' | 'funded', interval })
                    }
                  >
                    {isCurrent
                      ? 'Current plan'
                      : checkoutUnavailable
                        ? 'Not available yet'
                        : isDowngrade
                          ? `Switch to ${plan.name}`
                          : `Choose ${plan.name}`}
                  </Button>
                ) : null}

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

      {checkout.data && !checkout.data.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {checkout.data.error}
        </p>
      ) : null}
    </div>
  );
}

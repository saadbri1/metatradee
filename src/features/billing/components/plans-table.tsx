'use client';

/**
 * Plan comparison + checkout entry points. Prices come from the plan config
 * (display only — the provider is authoritative). Accessible: each plan is a
 * labelled group; the CTA names the tier. No hardcoded colors.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS, PAID_TIERS, type PlanTier } from '../plans';
import { useCheckout } from '../hooks';
import type { BillingInterval } from '../config';

function price(cents: number, interval: BillingInterval): string {
  if (cents === 0) return 'Free';
  const dollars = (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return `${dollars}/${interval === 'monthly' ? 'mo' : 'yr'}`;
}

const FEATURE_LABELS: Record<string, string> = {
  advancedAnalytics: 'Advanced analytics',
  brokerImport: 'Broker import',
  reportsExport: 'Report exports',
  reportSharing: 'Report sharing',
  aiCoach: 'AI Coach',
  propFirmTools: 'Prop-firm tools',
};

export function PlansTable({ currentTier }: { currentTier?: PlanTier }) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const checkout = useCheckout();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2" role="group" aria-label="Billing interval">
        <Button
          size="sm"
          variant={interval === 'monthly' ? 'default' : 'outline'}
          aria-pressed={interval === 'monthly'}
          onClick={() => setInterval('monthly')}
        >
          Monthly
        </Button>
        <Button
          size="sm"
          variant={interval === 'annual' ? 'default' : 'outline'}
          aria-pressed={interval === 'annual'}
          onClick={() => setInterval('annual')}
        >
          Annual
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(PLANS) as PlanTier[]).map((tier) => {
          const plan = PLANS[tier];
          const isCurrent = currentTier === tier;
          const enabledFeatures = Object.entries(plan.features).filter(([, v]) => v);
          return (
            <Card
              key={tier}
              aria-label={`${plan.name} plan`}
              className={isCurrent ? 'border-primary' : ''}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {plan.name}
                  {isCurrent ? <Badge>Current</Badge> : null}
                </CardTitle>
                <p className="tabular text-2xl font-semibold">
                  {price(interval === 'monthly' ? plan.priceMonthly : plan.priceAnnual, interval)}
                </p>
                {plan.trialDays > 0 ? (
                  <p className="text-xs text-muted-foreground">{plan.trialDays}-day free trial</p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  <li className="text-muted-foreground">
                    {plan.limits.maxTrades === null
                      ? 'Unlimited trades'
                      : `${plan.limits.maxTrades} trades`}
                  </li>
                  {enabledFeatures.map(([key]) => (
                    <li key={key} className="flex items-center gap-2">
                      <Check className="size-4 text-primary" aria-hidden />
                      {FEATURE_LABELS[key] ?? key}
                    </li>
                  ))}
                </ul>
                {tier !== 'free' && PAID_TIERS.includes(tier) ? (
                  <Button
                    className="w-full"
                    disabled={isCurrent || checkout.isPending}
                    onClick={() =>
                      checkout.mutate({ tier: tier as 'trader' | 'pro' | 'funded', interval })
                    }
                  >
                    {isCurrent ? 'Current plan' : `Choose ${plan.name}`}
                  </Button>
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

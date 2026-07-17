'use client';

/**
 * Pricing — rendered entirely from the billing PLANS source of truth. Prices are
 * NEVER hardcoded here; the provider remains authoritative for money. Client only
 * for the monthly/annual toggle. Honest: no fake discounts beyond what the config
 * encodes, no profit claims.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PLANS, type PlanTier, type Plan } from '@/features/billing/plans';

const ORDER: PlanTier[] = ['free', 'trader', 'pro', 'funded'];
const HIGHLIGHT: PlanTier = 'pro';

const FEATURE_LABELS: Record<keyof Plan['features'], string> = {
  aiCoach: 'AI coach reviews',
  brokerImport: 'Broker import',
  advancedAnalytics: 'Advanced analytics',
  reportsExport: 'Report export',
  reportSharing: 'Shareable reports',
  propFirmTools: 'Prop-firm tools',
};

function displayPrice(plan: Plan, annual: boolean): { amount: string; suffix: string } {
  const cents = annual ? plan.priceAnnual : plan.priceMonthly;
  if (cents === 0) return { amount: 'Free', suffix: '' };
  if (annual) {
    const perMonth = Math.round(cents / 12 / 100);
    return { amount: `$${perMonth}`, suffix: '/mo · billed yearly' };
  }
  return { amount: `$${Math.round(cents / 100)}`, suffix: '/mo' };
}

function planHighlights(plan: Plan): string[] {
  const out: string[] = [];
  out.push(plan.limits.maxTrades === null ? 'Unlimited trades' : `${plan.limits.maxTrades} trades`);
  out.push(
    plan.limits.maxAccounts === null
      ? 'Unlimited accounts'
      : `${plan.limits.maxAccounts} account${plan.limits.maxAccounts === 1 ? '' : 's'}`,
  );
  for (const key of Object.keys(FEATURE_LABELS) as (keyof Plan['features'])[]) {
    if (plan.features[key]) out.push(FEATURE_LABELS[key]);
  }
  return out;
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple, honest pricing
        </h2>
        <p className="mt-3 text-muted-foreground">
          Start free. Upgrade when your journal proves it&apos;s worth it. Cancel anytime.
        </p>

        <div
          className="mt-6 inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 text-sm"
          role="group"
          aria-label="Billing period"
        >
          <button
            type="button"
            onClick={() => setAnnual(false)}
            aria-pressed={!annual}
            className={`rounded-full px-4 py-1.5 transition-colors ${!annual ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            aria-pressed={annual}
            className={`rounded-full px-4 py-1.5 transition-colors ${annual ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ORDER.map((tier) => {
          const plan = PLANS[tier];
          const { amount, suffix } = displayPrice(plan, annual);
          const highlighted = tier === HIGHLIGHT;
          return (
            <Card
              key={tier}
              className={highlighted ? 'relative border-primary shadow-lg shadow-primary/10' : ''}
            >
              {highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  Most popular
                </span>
              )}
              <CardContent className="flex h-full flex-col p-5">
                <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="tabular font-display text-3xl font-semibold">{amount}</span>
                  {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
                </p>
                {plan.trialDays > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.trialDays}-day free trial
                  </p>
                )}
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {planHighlights(plan).map((h) => (
                    <li key={h} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-primary" aria-hidden />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-6 w-full"
                  variant={highlighted ? 'default' : 'outline'}
                >
                  <Link href="/register">
                    {tier === 'free' ? 'Start free' : `Choose ${plan.name}`}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Prices are shown for reference; billing is handled securely by our payment provider, which
        remains authoritative for all charges.
      </p>
    </section>
  );
}

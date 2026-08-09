'use client';

/**
 * The four plan cards with the monthly/yearly switch. Shared by the public
 * pricing page and the homepage pricing section so the two can never show
 * different numbers.
 *
 * Every figure is read from the central pricing config and the plan matrix —
 * nothing here is hardcoded, and the annual saving is computed from the actual
 * prices rather than asserted, so the badge cannot advertise a discount the
 * prices do not give.
 *
 * Pro is marked "Recommended", NOT "Most popular": popularity is a claim about
 * real user counts that nobody has measured. Recommending is an editorial
 * position and is honest; claiming popularity would be inventing a statistic.
 */
import { useId, useState } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLANS, type PlanTier } from '@/features/billing/plans';
import {
  ANNUAL_LABEL,
  RECOMMENDED_TIER,
  TIER_ORDER,
  TIER_TAGLINE,
  annualSavingPercent,
  formatPrice,
  isFree,
  monthlyEquivalent,
  priceFor,
  type BillingInterval,
} from '@/features/billing/pricing';

/** The handful of things a card leads with. Full detail lives in the table. */
function highlights(tier: PlanTier): string[] {
  const plan = PLANS[tier];
  const out: string[] = [];

  out.push(
    plan.limits.maxTrades === null
      ? 'Unlimited trades'
      : `${plan.limits.maxTrades.toLocaleString('en-US')} trades`,
  );
  out.push(
    plan.limits.maxAccounts === null
      ? 'Unlimited trading accounts'
      : `${plan.limits.maxAccounts} trading account${plan.limits.maxAccounts === 1 ? '' : 's'}`,
  );

  if (plan.features.brokerImport) out.push('Broker statement import');
  if (plan.features.advancedAnalytics) out.push('Advanced analytics & breakdowns');
  if (plan.features.playbookAdvanced) out.push('Playbook versioning & adherence');
  if (plan.features.tradeReplay) out.push('Bar-by-bar trade replay');
  if (plan.features.aiCoach) out.push('AI Coach reviews');
  if (plan.features.reportsExport) out.push('Report export (CSV, JSON, PDF)');
  if (plan.features.reportSharing) out.push('Shareable report links');

  return out;
}

function IntervalToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (next: BillingInterval) => void;
}) {
  const annual = interval === 'annual';
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="group"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 text-sm"
      >
        <button
          type="button"
          onClick={() => onChange('monthly')}
          aria-pressed={!annual}
          className={cn(
            'min-h-9 rounded-full px-5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
            !annual
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange('annual')}
          aria-pressed={annual}
          className={cn(
            'min-h-9 rounded-full px-5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
            annual
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Yearly
        </button>
      </div>
      <p className="text-sm font-medium text-primary">{ANNUAL_LABEL}</p>
    </div>
  );
}

function PlanCard({ tier, interval }: { tier: PlanTier; interval: BillingInterval }) {
  const plan = PLANS[tier];
  const price = priceFor(tier);
  const free = isFree(tier);
  const annual = interval === 'annual';
  const recommended = tier === RECOMMENDED_TIER;
  const headingId = `plan-${tier}`;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-card p-7',
        recommended
          ? 'border-primary shadow-[0_16px_40px_-24px_hsl(var(--primary)/0.6)]'
          : 'border-border/70',
      )}
    >
      {recommended ? (
        <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Recommended
        </span>
      ) : null}

      <h3 id={headingId} className="font-display text-xl font-semibold text-foreground">
        {plan.name}
      </h3>
      <p className="mt-2 min-h-[3.25rem] text-[0.9375rem] leading-6 text-muted-foreground">
        {TIER_TAGLINE[tier]}
      </p>

      {/*
       * The headline is what is actually charged, ONCE, for the selected
       * period. A "/month" figure on a payment that never repeats reads as a
       * subscription, and this product has none — the money buys a fixed
       * number of days and then stops.
       */}
      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-semibold tabular-nums tracking-tight text-foreground">
          {free ? 'Free' : formatPrice(annual ? price.annual : price.monthly)}
        </span>
        {!free ? <span className="text-sm text-muted-foreground">once</span> : null}
      </p>
      <p className="mt-1.5 min-h-[1.25rem] text-[0.8125rem] text-muted-foreground">
        {free ? (
          'No payment required'
        ) : annual ? (
          <>
            365 days access — works out at {formatPrice(monthlyEquivalent(tier))} a month, save{' '}
            {annualSavingPercent(tier)}%
          </>
        ) : (
          '30 days access'
        )}
      </p>

      <Link
        href="/register"
        /*
         * PLAN SELECTION. On the public pricing page choosing a plan means
         * clicking this CTA — there is no checkout here; PayPal lives in the
         * authenticated billing area and is untouched.
         *
         * `plan` and `billing_period` are catalogue values from `plans.ts`:
         * public facts about the product, not facts about the person. The
         * navigation is a real href, so a blocked beacon cannot cost a signup.
         */
        onClick={() =>
          trackEvent('plan_selected', {
            plan: tier,
            billing_period: annual ? 'annual' : 'monthly',
            source_page: 'pricing',
          })
        }
        aria-describedby={headingId}
        className={cn(
          'mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
          recommended
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border border-border text-foreground hover:bg-accent',
        )}
      >
        {free ? 'Start free' : 'Get started'}
      </Link>
      {!free ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {annual ? '365 days access' : '30 days access'}. No automatic renewal.
        </p>
      ) : null}

      <ul className="mt-7 flex-1 space-y-2.5 text-[0.9375rem]">
        {highlights(tier).map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="leading-6 text-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlanCards({ className }: { className?: string }) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const listId = useId();

  return (
    <div className={className}>
      <div className="flex justify-center">
        <IntervalToggle interval={interval} onChange={setInterval} />
      </div>

      <div
        id={listId}
        className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
        // The prices change when the toggle changes; announce politely rather
        // than moving focus, so a keyboard user stays on the control.
        aria-live="polite"
      >
        {TIER_ORDER.map((tier) => (
          <PlanCard key={tier} tier={tier} interval={interval} />
        ))}
      </div>
    </div>
  );
}

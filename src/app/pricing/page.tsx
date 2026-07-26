import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { PageHero, PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import { PLANS, type PlanTier } from '@/features/billing/plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'MetaTradee is in early access. Compare what each plan unlocks while pricing is being finalised.',
  alternates: { canonical: '/pricing' },
};

/**
 * PRICING HONESTY
 *
 * `@/features/billing/plans` documents its price fields as placeholders to be
 * reconciled when the pricing decision lands. This page therefore shows NO
 * monthly figure — publishing a placeholder as if it were the real price would
 * be inventing a price.
 *
 * What it does show is real: the feature flags and numeric limits below are the
 * same values the server enforces for entitlements, read directly from `PLANS`.
 * So the capability comparison is accurate even though the money is not set.
 */
const TIER_ORDER: PlanTier[] = ['free', 'trader', 'pro', 'funded'];

const TIER_BLURB: Record<PlanTier, string> = {
  free: 'Try the journal and see whether the workflow suits you.',
  trader: 'For a trader who wants the full history and the analytics behind it.',
  pro: 'Adds the evidence-linked AI coach and shareable reports.',
  funded: 'For traders running evaluation and funded accounts in parallel.',
};

const FEATURE_ROWS: { key: keyof typeof PLANS.free.features; label: string }[] = [
  { key: 'brokerImport', label: 'Statement import (CSV / JSON)' },
  { key: 'advancedAnalytics', label: 'Advanced analytics & breakdowns' },
  { key: 'aiCoach', label: 'AI Coach reviews' },
  { key: 'reportsExport', label: 'Report export' },
  { key: 'reportSharing', label: 'Shareable report links' },
  { key: 'propFirmTools', label: 'Funded-account tools' },
];

const LIMIT_ROWS: { key: keyof typeof PLANS.free.limits; label: string }[] = [
  { key: 'maxTrades', label: 'Trades' },
  { key: 'maxAccounts', label: 'Trading accounts' },
  { key: 'maxStrategies', label: 'Playbooks' },
  { key: 'maxReportsPerMonth', label: 'Reports per month' },
  { key: 'aiReviewsPerMonth', label: 'AI reviews per month' },
];

/** `null` means no cap — say "Unlimited", never a made-up number. */
function limitLabel(value: number | null): string {
  return value === null ? 'Unlimited' : value.toLocaleString('en-US');
}

export default function PricingPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Pricing"
        title="Early access — pricing is not finalised yet"
        lede="We would rather show you exactly what each plan unlocks than publish a number we might change. Join early access and you will hear the pricing before it goes live."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/register"
            className="inline-flex items-center rounded-xl bg-gradient-to-r from-primary to-iris px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Get Started — free plan
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center rounded-xl border border-border px-8 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See what is included
          </Link>
        </div>
      </PageHero>

      <PageSection>
        <div className="grid gap-5 lg:grid-cols-4">
          {TIER_ORDER.map((tier) => {
            const plan = PLANS[tier];
            const isFree = tier === 'free';
            return (
              <div
                key={tier}
                className="flex flex-col rounded-2xl border border-border/70 bg-card p-7"
              >
                <p className="font-display text-xl font-semibold text-foreground">{plan.name}</p>
                <p className="mt-2 min-h-[3rem] text-[0.9375rem] leading-6 text-muted-foreground">
                  {TIER_BLURB[tier]}
                </p>
                <p className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                  {isFree ? 'Free' : 'Early access'}
                </p>
                <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                  {isFree ? 'No card required' : 'Price to be announced'}
                </p>
                <Link
                  href="/register"
                  className="mt-6 inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-[0.9375rem] font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isFree ? 'Start free' : 'Join early access'}
                </Link>
              </div>
            );
          })}
        </div>
      </PageSection>

      <PageSection
        title="What each plan unlocks"
        lede="These capabilities and limits are the values the server actually enforces — they are accurate today, independent of final pricing."
      >
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
          <table className="w-full min-w-[880px] border-collapse text-left text-[0.9375rem]">
            <caption className="sr-only">Feature and limit comparison across plans</caption>
            <thead className="border-b border-border/70 bg-muted/50 text-[0.8125rem] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold">
                  Capability
                </th>
                {TIER_ORDER.map((tier) => (
                  <th key={tier} scope="col" className="px-6 py-4 text-center font-semibold">
                    {PLANS[tier].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-border/50">
                  <th scope="row" className="px-6 py-4 font-medium text-foreground">
                    {row.label}
                  </th>
                  {TIER_ORDER.map((tier) => (
                    <td key={tier} className="px-6 py-4 text-center">
                      {PLANS[tier].features[row.key] ? (
                        <>
                          <Check className="mx-auto size-5 text-profit" aria-hidden />
                          <span className="sr-only">Included</span>
                        </>
                      ) : (
                        <>
                          <Minus className="mx-auto size-5 text-muted-foreground/60" aria-hidden />
                          <span className="sr-only">Not included</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {LIMIT_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-border/50 last:border-0">
                  <th scope="row" className="px-6 py-4 font-medium text-foreground">
                    {row.label}
                  </th>
                  {TIER_ORDER.map((tier) => (
                    <td
                      key={tier}
                      className="px-6 py-4 text-center tabular-nums text-muted-foreground"
                    >
                      {limitLabel(PLANS[tier].limits[row.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 max-w-3xl text-[0.9375rem] leading-7 text-muted-foreground">
          Plans, limits and prices are still being finalised and may change before general
          availability. Nothing on this page is a billing commitment, and no payment is taken during
          early access.
        </p>
      </PageSection>
    </PublicShell>
  );
}

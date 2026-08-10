import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { PageHero, PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import { PlanCards } from '@/features/marketing/components/plan-cards';
import { PLANS, COMING_SOON, type PlanFeatures, type PlanLimits } from '@/features/billing/plans';
import { TIER_ORDER } from '@/features/billing/pricing';
import { isBillingMock } from '@/features/billing/providers/router';
import { mailto } from '@/config/contact';
import { absoluteUrl } from '@/config/seo';
import { siteConfig } from '@/config/site';
import { faqPageLdFrom, serializeJsonLd, SOFTWARE_ID } from '@/features/marketing/seo';
import { TrackOnMount } from '@/lib/analytics/track-on-mount';

export const metadata: Metadata = metadataFor('/pricing');

/**
 * PRICING HONESTY
 *
 * Every price, limit and capability on this page is read from the billing
 * config the server actually enforces — the comparison table is the same data
 * the entitlement gates use, so what is sold and what is granted cannot drift
 * apart.
 *
 * Two things are deliberately absent: any capability that is not built (those
 * are listed as "Coming soon" with no plan attached and no price), and any
 * claim about user counts, popularity, or trading outcomes.
 */

const FEATURE_ROWS: { key: keyof PlanFeatures; label: string }[] = [
  { key: 'brokerImport', label: 'Broker statement import (CSV / JSON)' },
  { key: 'advancedAnalytics', label: 'Advanced analytics & breakdowns' },
  { key: 'playbookAdvanced', label: 'Playbook versioning & adherence' },
  { key: 'tradeReplay', label: 'Bar-by-bar trade replay' },
  { key: 'aiCoach', label: 'AI Coach reviews' },
  { key: 'reportsExport', label: 'Report export (CSV, JSON, PDF)' },
  { key: 'reportSharing', label: 'Shareable report links' },
];

const LIMIT_ROWS: { key: keyof PlanLimits; label: string }[] = [
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

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What happens when my access ends?',
    a: 'Your account moves to the Free plan. Nothing renews and nothing is charged again — a payment buys 30 or 365 days and then stops. Your trades, playbooks and notes stay exactly where they are; nothing is deleted. You keep reading everything you recorded, and only the paid capabilities and the higher limits stop.',
  },
  {
    q: 'Will I be charged automatically?',
    a: 'No. There is no subscription and no stored payment method. Each payment is a single one-off through PayPal, and when the period runs out you simply return to Free until you choose to buy more access.',
  },
  {
    q: 'Can I change plan later?',
    a: 'Yes, in either direction, at any time. Billing changes are handled by our payment provider, which is authoritative for what you are actually charged and applies any proration.',
  },
  {
    q: 'What does yearly billing actually save?',
    a: 'Yearly is priced at ten months instead of twelve, so you pay 17% less than twelve monthly payments — two months free. The saving shown on this page is calculated from the prices themselves.',
  },
  {
    q: 'Do I need a card for the Free plan?',
    a: 'No. The Free plan needs no payment method and does not expire. It caps how much you can store rather than removing the journal itself.',
  },
  {
    q: 'What happens if a payment fails?',
    a: 'Access continues during the retry window rather than cutting off immediately, and the app tells you it needs attention. If it is never resolved the account moves to the Free plan — again, without deleting anything.',
  },
  {
    q: 'Is my trading data used to train anything?',
    a: 'No. Your trades are yours. Reports are private by default, and a shared report link never includes your psychology notes.',
  },
];

export default function PricingPage() {
  const comingSoon = Object.values(COMING_SOON);
  /*
   * Truthfulness gate. With no payment provider connected, nobody can actually
   * buy access — so the page must not imply otherwise. This
   * notice removes itself the moment Stripe is configured; it is derived from
   * the same check the billing page uses, not a hand-set flag.
   */
  const notOnSaleYet = isBillingMock();

  /*
   * STRUCTURED DATA FOR THE PRICES THE PAGE ALREADY SHOWS.
   *
   * "What does each plan cost" is one of the questions answer engines are most
   * often asked about a SaaS product, and until now this page — the only page
   * that knows — published no machine-readable answer at all. The offers below
   * are built from `PLANS`, the same object the comparison table and the
   * server-side entitlement gates read, so a price cannot be marked up as one
   * number and enforced as another.
   *
   * AVAILABILITY IS DERIVED, NOT ASSERTED. While `isBillingMock()` is true
   * nobody can actually buy anything, which is why the page renders the "not on
   * sale yet" notice. Claiming `InStock` for a paid tier in that state would be
   * a false claim in the one format that gets quoted without a human reading
   * the caveat next to it. So paid tiers carry NO availability until checkout
   * opens — an omitted field beats an untrue one — while Free is genuinely
   * usable today and says so. When billing goes live both the notice and this
   * field flip from the same source.
   */
  const pricingLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      /* The same node the homepage describes — one product, not a second one
         that happens to share a name. */
      '@id': SOFTWARE_ID,
      name: siteConfig.name,
      applicationCategory: 'FinanceApplication',
      applicationSubCategory: 'Trading journal',
      operatingSystem: 'Web',
      url: absoluteUrl('/'),
      description: siteConfig.description,
      offers: TIER_ORDER.map((tier) => {
        const plan = PLANS[tier];
        const isFreePlan = plan.priceMonthly === 0;
        const purchasable = isFreePlan || !notOnSaleYet;
        return {
          '@type': 'Offer',
          name: plan.name,
          url: absoluteUrl('/pricing'),
          price: (plan.priceMonthly / 100).toFixed(2),
          priceCurrency: plan.currency.toUpperCase(),
          /* The price above is per month — say so rather than leaving a bare
             number that reads as a one-off purchase. */
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: (plan.priceMonthly / 100).toFixed(2),
            priceCurrency: plan.currency.toUpperCase(),
            billingDuration: 1,
            unitCode: 'MON',
          },
          ...(purchasable ? { availability: 'https://schema.org/InStock' } : {}),
        };
      }),
    },
    /* The same array the FAQ below renders — never a second copy of it. */
    faqPageLdFrom(FAQ),
  ];

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(pricingLd) }}
      />
      {/* Pricing interest. No plan, no amount — just that the page was seen. */}
      <TrackOnMount event="pricing_viewed" props={{}} />
      <PageHero
        path="/pricing"
        eyebrow="Pricing"
        title="Pick the plan that matches how much you trade"
        lede="Start free and keep the journal for as long as you like. Paid access is bought 30 or 365 days at a time and never renews automatically, and nothing you have recorded is deleted if you move back down."
      />

      <PageSection>
        {notOnSaleYet ? (
          <p
            role="status"
            className="mx-auto mb-8 max-w-3xl rounded-xl border border-border bg-muted/40 px-5 py-4 text-center text-[0.9375rem] leading-6 text-muted-foreground"
          >
            <strong className="font-semibold text-foreground">
              Paid plans are not on sale yet.
            </strong>{' '}
            You can create a free account today and use the journal straight away. The prices below
            are final, and we will not charge anyone before checkout opens.
          </p>
        ) : null}
        <PlanCards />
      </PageSection>

      <PageSection
        title="Compare every plan"
        lede="These capabilities and limits are the exact values the server enforces — what is listed here is what your account is granted."
      >
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
          <table className="w-full min-w-[880px] border-collapse text-left text-[0.9375rem]">
            <caption className="sr-only">
              Feature and limit comparison across all four plans
            </caption>
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

        {/*
          Listed separately, with no plan column and no price. These are not
          built, so no plan may be sold on them.
        */}
        <div className="mt-8 rounded-2xl border border-dashed border-border/70 bg-muted/25 p-6">
          <h3 className="text-[0.9375rem] font-semibold text-foreground">
            Not built yet — no plan includes these
          </h3>
          <p className="mt-1.5 max-w-3xl text-[0.9375rem] leading-6 text-muted-foreground">
            We list them so you can see what is planned, not to sell them. They are not part of any
            plan and are not reflected in any price.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {comingSoon.map((label) => (
              <li
                key={label}
                className="rounded-full border border-border bg-background px-3 py-1 text-[0.8125rem] text-muted-foreground"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      </PageSection>

      <PageSection title="Questions people ask before paying">
        <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-display text-lg font-semibold text-foreground">{item.q}</dt>
              <dd className="mt-2 text-[0.9375rem] leading-7 text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </PageSection>

      <PageSection>
        <div className="rounded-2xl border border-border/70 bg-accent/35 px-6 py-12 text-center sm:px-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Start with the free journal
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            No card, no renewal to forget about. Record trades, build a playbook, and pay for access
            only once the journal has earned it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.85)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Create a free account
            </Link>
            <Link
              href="/products"
              className="inline-flex min-h-12 items-center rounded-xl border border-border px-8 text-base font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              See what is included
            </Link>
          </div>
          {/*
           * Sales contact. Deliberately a quiet text link under the buttons
           * rather than a third CTA: the plan cards above are the conversion
           * path, and a same-weight "Contact sales" competes with them. It
           * exists for the reader who needs several seats or an invoice —
           * people who will look for it.
           */}
          <p className="mt-6 text-sm text-muted-foreground">
            Buying for a team, or need an invoice?{' '}
            <a
              href={mailto('sales', 'Team or enterprise plan enquiry')}
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Talk to sales
            </a>
            .
          </p>
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-[0.8125rem] leading-6 text-muted-foreground">
          Prices are in USD and exclude any tax that applies where you live. Billing is handled by
          our payment provider, which remains authoritative for every charge. MetaTradee is a
          journalling and analytics tool — it does not provide financial advice and makes no claim
          about your trading results.
        </p>
      </PageSection>
    </PublicShell>
  );
}

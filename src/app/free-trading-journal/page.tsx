import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import {
  CheckList,
  LandingSection,
  LandingShell,
} from '@/features/marketing/components/landing-shell';
import { PLANS } from '@/features/billing/plans';
import { TIER_ORDER, formatPrice, priceFor } from '@/features/billing/pricing';

export const metadata: Metadata = metadataFor('/free-trading-journal');

/*
 * EVERY NUMBER ON THIS PAGE IS READ FROM `plans.ts`.
 *
 * A free-plan page that overstates the free plan is the most expensive kind of
 * page to get wrong: it converts, and then it produces a refund request and a
 * bad review. Deriving the limits means the copy cannot drift from the product.
 */
const FREE = PLANS.free;
const FIRST_IMPORT_TIER = TIER_ORDER.find((t) => PLANS[t].features.brokerImport)!;
const IMPORT_PLAN = PLANS[FIRST_IMPORT_TIER];

export default function FreeTradingJournalPage() {
  return (
    <LandingShell
      path="/free-trading-journal"
      eyebrow="Free plan"
      title="A free trading journal, with the limits stated up front"
      lede={`Journal ${FREE.limits.maxTrades} trades on one account without a credit card. Here is exactly what that includes — and, just as importantly, what it does not.`}
      ctaLabel="Create a free account"
      faqs={[
        {
          q: 'Is a credit card required?',
          a: 'No. The Free plan needs no card and does not expire. There is no trial countdown on it, because it is not a trial.',
        },
        {
          q: 'How many trades can I log?',
          a: `${FREE.limits.maxTrades} trades, on ${FREE.limits.maxAccounts} trading account, with up to ${FREE.limits.maxStrategies} strategies and ${FREE.limits.maxReportsPerMonth} report per month.`,
        },
        {
          q: 'Can I import my broker history on the free plan?',
          a: `No. Statement import starts on the ${IMPORT_PLAN.name} plan. On Free you log trades manually, which is also the fastest way to find out whether the routine suits you before paying for anything.`,
        },
        {
          q: 'Does the free plan include the AI coach?',
          a: `No. The free plan includes ${FREE.limits.aiReviewsPerMonth} AI reviews per month — zero. The coach starts on a higher plan.`,
        },
        {
          q: 'What happens when I reach the trade limit?',
          a: 'Your data stays yours and stays visible. You choose whether to upgrade; nothing is deleted and nothing is held hostage.',
        },
        {
          q: 'Do paid plans renew automatically?',
          a: 'No. Paid access is bought 30 or 365 days at a time and never renews on its own.',
        },
      ]}
      related={[
        {
          href: '/trading-journal',
          label: 'Trading journal',
          description: 'How the journal computes P&L, R and risk-reward from one engine.',
        },
        {
          href: '/pricing',
          label: 'Compare all four plans',
          description: 'Every limit and feature, side by side, with real prices.',
        },
        {
          href: '/tools',
          label: 'Free calculators',
          description: 'Position size, gold lot size and risk/reward — no account at all.',
        },
      ]}
    >
      <LandingSection title="What the free plan actually includes">
        <CheckList
          items={[
            `${FREE.limits.maxTrades} logged trades`,
            `${FREE.limits.maxAccounts} trading account`,
            `${FREE.limits.maxStrategies} strategies`,
            `${FREE.limits.maxReportsPerMonth} report per month`,
            'Server-computed gross and net P&L and planned reward-to-risk — the same engine every plan uses',
            'Tags, notes and screenshots on every trade',
            'Row-level security on your data, exactly as on a paid plan',
            'No credit card, no expiry, no trial countdown',
          ]}
        />
      </LandingSection>

      <LandingSection title="What it does not include">
        <p>
          Stated as plainly as the list above, because a free plan whose limits only surface after
          signup is a bait.
        </p>
        <CheckList
          items={[
            `Broker statement import — starts on ${IMPORT_PLAN.name} (${formatPrice(priceFor(FIRST_IMPORT_TIER).monthly)}/month)`,
            'AI coach reviews — the free allowance is zero',
            'Advanced analytics, trade replay, report export and report sharing',
            'Versioned playbooks with adherence measurement',
          ]}
        />
      </LandingSection>

      <LandingSection title="Why the free plan is manual">
        <p>
          It is a deliberate line, not an oversight. Logging {FREE.limits.maxTrades} trades by hand
          is enough to answer the only question that matters early on:{' '}
          <em>will I actually keep a journal?</em> Most people find that out in a fortnight, and it
          costs nothing to find out here.
        </p>
        <p>
          Importing years of history is a different job, and it is the one that carries real cost on
          our side — parsing, validating and de-duplicating statements. That is what the paid plans
          pay for.
        </p>
      </LandingSection>

      <LandingSection title="Free tools, with no account at all">
        <p>
          The position-size, gold lot-size and risk/reward calculators are fully usable without
          signing up, without an email, and with the formula printed on the page. If you only need a
          number today, take it — no account required.
        </p>
      </LandingSection>
    </LandingShell>
  );
}

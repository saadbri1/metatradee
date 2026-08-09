import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import {
  CheckList,
  LandingSection,
  LandingShell,
} from '@/features/marketing/components/landing-shell';
import { PLANS } from '@/features/billing/plans';
import { TIER_ORDER, formatPrice, priceFor } from '@/features/billing/pricing';

export const metadata: Metadata = metadataFor('/ai-trading-journal');

/** The cheapest tier whose feature flags actually include the AI coach. */
const AI_TIER = TIER_ORDER.find((t) => PLANS[t].features.aiCoach)!;
const AI_PLAN = PLANS[AI_TIER];

export default function AiTradingJournalPage() {
  return (
    <LandingShell
      path="/ai-trading-journal"
      eyebrow="AI trading journal"
      title="An AI coach that only cites your own trades"
      lede="It reviews the trades you actually took and links to the specific ones behind every observation, so you can check its reasoning. It does not predict prices, issue buy or sell calls, or give financial advice."
      faqs={[
        {
          q: 'Does the AI tell me what to trade?',
          a: 'No. It never issues buy or sell calls, price predictions or financial advice. Its output passes a safety filter before you see it, and any sentence that reads as a trade call or a guarantee is removed rather than shown.',
        },
        {
          q: 'What data does it look at?',
          a: 'Your own logged trades and the context you recorded with them. It does not read market data, news or anyone else’s account, and row-level security means it cannot reach another user’s records.',
        },
        {
          q: 'How do I know it is not making things up?',
          a: 'Every observation links to the specific trades it came from. If a claim has no evidence behind it, you can see that immediately — which is the point of citing rather than asserting.',
        },
        {
          q: 'Which plan includes the AI coach?',
          a: `The ${AI_PLAN.name} plan and above. It is ${formatPrice(priceFor(AI_TIER).monthly)} per month, and the Free plan includes no AI reviews.`,
        },
        {
          q: 'Is my trading data used to train a model?',
          a: 'No. Your trades are sent to the configured model only to produce your own review, and the review is grounded in those trades. Nothing is used to train anything.',
        },
      ]}
      related={[
        {
          href: '/trading-journal',
          label: 'Trading journal',
          description: 'The journal the coach reads from, and how the numbers are computed.',
        },
        {
          href: '/free-trading-journal',
          label: 'Free trading journal',
          description: 'Start without a card. The free plan includes no AI reviews.',
        },
        {
          href: '/pricing',
          label: 'Plans and limits',
          description: `AI reviews start on ${AI_PLAN.name}, with a monthly cap stated up front.`,
        },
      ]}
    >
      <LandingSection title="What it actually does">
        <p>
          The coach reads your logged trades and writes an evidence-linked review: patterns it can
          point at, and the trades that demonstrate them. Every observation carries links to the
          specific records behind it.
        </p>
        <CheckList
          items={[
            'Reviews the trades you logged, not the market',
            'Cites the specific trades behind each observation so you can check the reasoning',
            'Output passes a safety filter before it reaches you',
            'Scoped to your own data by row-level security',
          ]}
        />
      </LandingSection>

      <LandingSection title="What it deliberately will not do">
        <p>
          This is a financial product, so the limits matter more than the features. The coach does
          not tell you what to buy or sell, does not predict where a price is going, does not
          promise a return, and does not claim to have placed or managed anything.
        </p>
        <p>
          Those are not prompt instructions and nothing more. Output is scanned for trade calls,
          price predictions, guarantees and autopilot claims before display, and an offending
          sentence is replaced rather than trusted — a model that ignored its instructions still
          cannot get such a sentence in front of you.
        </p>
      </LandingSection>

      <LandingSection title="Grounding, and why it is the whole design">
        <p>
          An assistant that answers from a model&rsquo;s own memory will eventually invent a
          confident, wrong number. The coach is built the other way round: it works from your
          records, and an observation it cannot tie to a trade is not an observation it makes.
        </p>
        <p>
          The same principle runs through the public support assistant on this site, which answers
          only from approved product information and says plainly when it does not know.
        </p>
      </LandingSection>

      <LandingSection title="Availability, stated plainly">
        <p>
          AI reviews are part of the {AI_PLAN.name} plan and above, at{' '}
          {formatPrice(priceFor(AI_TIER).monthly)} per month. The Free plan includes{' '}
          <strong className="text-foreground">no AI reviews at all</strong> — the monthly allowance
          is zero, not a small number — and every paid plan states its allowance before you commit.
        </p>
      </LandingSection>
    </LandingShell>
  );
}

import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import { RiskRewardForm } from '@/features/tools/components/risk-reward-form';
import { Formula, ToolLayout, ToolSection } from '@/features/tools/components/tool-layout';

export const metadata: Metadata = metadataFor('/tools/risk-reward-calculator');

export default function RiskRewardCalculatorPage() {
  return (
    <ToolLayout
      path="/tools/risk-reward-calculator"
      eyebrow="Free tool"
      title="Risk/reward ratio calculator"
      lede="Enter an entry, a stop and a target. Get the ratio — and the win rate that ratio has to beat before the setup makes money."
      calculator={<RiskRewardForm />}
      calculatorId="risk_reward"
      faqs={[
        {
          q: 'How is the risk/reward ratio calculated?',
          a: 'Reward divided by risk, both measured as price distances from your entry. Risk is the distance from entry to stop, reward is the distance from entry to target. An entry at 100 with a stop at 98 and a target at 106 is 6 ÷ 2 = 3, written 3:1.',
        },
        {
          q: 'What win rate does a given risk/reward ratio need?',
          a: 'The breakeven win rate is risk ÷ (risk + reward), or 1 ÷ (1 + R). A 1:1 setup needs to win more than 50% of the time, 2:1 needs more than 33.3%, and 3:1 needs more than 25%. Below that threshold the setup loses money however good the ratio looks.',
        },
        {
          q: 'Is a higher risk/reward ratio always better?',
          a: 'Not on its own. A ratio only tells you what win rate the setup must beat; it says nothing about whether your setup actually achieves it. A 5:1 target that fills 10% of the time loses money, while a 1:1 that fills 60% of the time makes it. The ratio and the hit rate have to be read together.',
        },
        {
          q: 'Does the breakeven win rate include costs?',
          a: 'No, and that makes it a floor rather than a target. Spread, commission and swap all raise the real breakeven, so a setup that needs 33.3% on paper needs somewhat more in practice.',
        },
        {
          q: 'Why does the calculator reject my target?',
          a: 'The target has to sit on the opposite side of your entry from the stop. A long with a target below entry, or a short with a target above it, is a typo rather than a trade — computing a ratio from it would return a confident negative number that looks like an answer.',
        },
      ]}
      related={[
        {
          href: '/tools/position-size-calculator',
          destinationType: 'calculator',
          label: 'Position size calculator',
          description: 'Once the stop is set, work out how many lots it supports.',
        },
        {
          href: '/tools/xauusd-lot-size-calculator',
          destinationType: 'calculator',
          label: 'XAUUSD lot size calculator',
          description: 'Gold sizing with the contract size already filled in.',
        },
        {
          href: '/trading-journal',
          destinationType: 'product',
          label: 'Trading journal',
          description: 'See the risk/reward you actually realised across your own trades.',
        },
      ]}
    >
      <ToolSection title="The ratio is only half the answer">
        <p>
          &ldquo;3:1&rdquo; sounds good and &ldquo;1:1&rdquo; sounds poor, but neither statement
          means anything on its own. What decides whether a setup is worth taking is the win rate
          the ratio requires:
        </p>
        <Formula>{`risk   = |entry − stop|
reward = |target − entry|
ratio  = reward ÷ risk
breakeven win rate = risk ÷ (risk + reward)`}</Formula>
        <p>
          A 3:1 setup breaks even at a 25% win rate. A 1:1 setup needs 50%. A 0.5:1 setup needs 67%.
          None of those is good or bad until you compare it with how often that setup actually wins
          in your own history.
        </p>
      </ToolSection>

      <ToolSection title="A worked example">
        <p>Long gold at 2000, stop at 1990, target at 2030:</p>
        <Formula>{`risk   = |2000 − 1990| = 10
reward = |2030 − 2000| = 30
ratio  = 30 ÷ 10       = 3.00 : 1
breakeven = 10 ÷ (10 + 30) = 25%`}</Formula>
        <p>
          So this setup needs to work slightly more than one time in four. If your record shows it
          works one time in five, the ratio is attractive and the setup still loses money.
        </p>
      </ToolSection>

      <ToolSection title="Why the breakeven figure is a floor">
        <p>
          The calculation uses the prices you enter and nothing else. Every real cost — spread,
          commission, swap, and slippage on the stop — pushes the required win rate above the number
          shown. On a tight intraday setup those costs are a meaningful share of the reward, so
          treat the result as the best case rather than the expected one.
        </p>
        <p>
          The calculator also refuses a target on the wrong side of the entry. A &ldquo;long&rdquo;
          with a target below entry is a typo rather than a trade, and returning a confident
          negative ratio for it would look like an answer.
        </p>
      </ToolSection>

      <ToolSection title="Planned versus realised">
        <p>
          This is the ratio you <em>planned</em>. The one that matters is the ratio you{' '}
          <em>realised</em> — after partial exits, moved stops and targets taken early. Those two
          numbers are often very different, and the gap between them is usually more informative
          than either figure alone.
        </p>
      </ToolSection>
    </ToolLayout>
  );
}

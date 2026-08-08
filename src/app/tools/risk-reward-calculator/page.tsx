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
      related={[
        {
          href: '/tools/position-size-calculator',
          label: 'Position size calculator',
          description: 'Once the stop is set, work out how many lots it supports.',
        },
        {
          href: '/tools/xauusd-lot-size-calculator',
          label: 'XAUUSD lot size calculator',
          description: 'Gold sizing with the contract size already filled in.',
        },
        {
          href: '/products',
          label: 'Analytics',
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

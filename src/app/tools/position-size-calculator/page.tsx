import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import { PositionSizeForm } from '@/features/tools/components/position-size-form';
import { Formula, ToolLayout, ToolSection } from '@/features/tools/components/tool-layout';

export const metadata: Metadata = metadataFor('/tools/position-size-calculator');

export default function PositionSizeCalculatorPage() {
  return (
    <ToolLayout
      path="/tools/position-size-calculator"
      eyebrow="Free tool"
      title="Position size calculator"
      lede="Work out how many lots to trade from your account balance, the percentage you are willing to risk, and where your stop sits. The arithmetic is shown in full."
      calculator={<PositionSizeForm />}
      calculatorId="position_size"
      related={[
        {
          href: '/tools/xauusd-lot-size-calculator',
          destinationType: 'calculator',
          label: 'XAUUSD lot size calculator',
          description: 'The same calculation with the gold contract size already filled in.',
        },
        {
          href: '/tools/risk-reward-calculator',
          destinationType: 'calculator',
          label: 'Risk/reward calculator',
          description: 'Turn entry, stop and target into a ratio and the win rate it needs.',
        },
        {
          href: '/trading-journal',
          destinationType: 'product',
          label: 'Trading journal',
          description: 'Record the trades you sized and see whether the sizing held up.',
        },
      ]}
    >
      <ToolSection title="How the calculation works">
        <p>
          Position sizing answers one question: how large can this trade be so that being wrong
          costs a known, chosen amount? Three numbers decide it — what the account holds, what
          fraction of it you are prepared to lose on one idea, and how far the price has to travel
          against you before you accept the idea was wrong.
        </p>
        <Formula>{`risk amount  = balance × risk %
loss per lot = stop distance (in price) × contract size
position     = risk amount ÷ loss per lot`}</Formula>
        <p>
          Working in <strong>price distance</strong> rather than pips is what keeps this to a single
          formula. A gold stop of &ldquo;$5&rdquo; and a EURUSD stop of &ldquo;20 pips&rdquo; are
          the same kind of quantity once both are written as a price move, and instruments then
          differ only by contract size. The calculator converts pips to price for you.
        </p>
      </ToolSection>

      <ToolSection title="A worked example">
        <p>
          A $10,000 account, risking 2% per trade, entering EURUSD with a 20-pip stop. One standard
          lot of EURUSD is 100,000 units, and one pip is 0.0001.
        </p>
        <Formula>{`risk amount  = 10,000 × 2%          = $200
stop (price) = 20 × 0.0001          = 0.0020
loss per lot = 0.0020 × 100,000     = $200
position     = 200 ÷ 200            = 1.00 lot`}</Formula>
        <p>
          Widen the stop to 40 pips and the position halves to 0.50 lots. The risk stays $200 — that
          is the point. Sizing is what keeps a wider stop from becoming a bigger loss.
        </p>
      </ToolSection>

      <ToolSection title="Assumptions, and where they stop holding">
        <p>
          The result is exact when the instrument is quoted in your account currency — a USD account
          trading EURUSD or XAUUSD, for instance. If you hold a EUR account and trade a USD-quoted
          instrument, the figure is in the <em>quote</em> currency and needs converting at the rate
          you actually get. This calculator does not invent an exchange rate for you.
        </p>
        <p>
          It also excludes spread, commission and swap. Those decide what a trade costs to hold;
          they do not change what a stop-out costs, which is what sizing is for. And it rounds{' '}
          <strong>down</strong> to 0.01 lots, never up — rounding up would quietly risk more than
          the percentage you asked for.
        </p>
        <p>
          Contract sizes here follow the common retail conventions. Brokers differ, particularly on
          mini and micro accounts, so confirm yours before sizing a live position.
        </p>
      </ToolSection>

      <ToolSection title="Sizing one trade versus sizing all of them">
        <p>
          A calculator tells you what a single position should be. It cannot tell you whether you
          actually traded that size, or whether the 2% you intended was 2% on Monday and 6% by
          Thursday. That only shows up across a whole history — which is what a journal is for.
        </p>
      </ToolSection>
    </ToolLayout>
  );
}

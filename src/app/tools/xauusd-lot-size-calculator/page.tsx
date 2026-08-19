import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import { instrumentById } from '@/features/tools/instruments';
import { PositionSizeForm } from '@/features/tools/components/position-size-form';
import { Formula, ToolLayout, ToolSection } from '@/features/tools/components/tool-layout';

export const metadata: Metadata = metadataFor('/tools/xauusd-lot-size-calculator');

const GOLD = instrumentById('xauusd')!;

export default function XauusdLotSizeCalculatorPage() {
  return (
    <ToolLayout
      path="/tools/xauusd-lot-size-calculator"
      eyebrow="Free tool"
      title="XAUUSD lot size calculator"
      lede="Size a gold position from your risk and a stop measured in dollars. The gold contract size is already filled in, and every step of the arithmetic is shown."
      calculator={<PositionSizeForm lockedInstrument={GOLD} />}
      calculatorId="xauusd_lot_size"
      faqs={[
        {
          q: 'What is one standard lot of XAUUSD?',
          a: '100 troy ounces, which is the common retail gold contract and the figure this calculator uses. A $1 move in the gold price is therefore $100 per standard lot. Brokers differ, particularly on mini and micro accounts, so confirm yours before sizing a live position.',
        },
        {
          q: 'How many dollars is a pip on gold?',
          a: 'A XAUUSD pip is usually $0.10, so a $5 stop is 50 pips. This is where most gold sizing errors come from: entering 5 where a pip-based tool expected 50 undersizes the position by a factor of ten. This calculator accepts the stop in dollars or in pips and converts for you.',
        },
        {
          q: 'How do I calculate gold lot size from a dollar risk?',
          a: 'Divide the money you are risking by the stop distance in dollars multiplied by 100 ounces. Risking $200 with a $5 stop gives $200 ÷ ($5 × 100) = 0.40 lots.',
        },
        {
          q: 'Why is my gold position smaller than I expected?',
          a: 'Gold moves in whole dollars far more readily than a forex pair moves in whole pips, so a stop that feels tight in gold terms is a large price distance. At a fixed cash risk a wider stop must produce a smaller position — that is the sizing working, not failing.',
        },
        {
          q: 'Does this work for XAGUSD and other metals?',
          a: 'Use the general position size calculator for silver, oil, indices and forex pairs. It is the same arithmetic with the contract size of the instrument you choose rather than gold’s 100 ounces.',
        },
      ]}
      related={[
        {
          href: '/tools/position-size-calculator',
          destinationType: 'calculator',
          label: 'Position size calculator',
          description: 'The same maths for forex pairs, silver, oil and indices.',
        },
        {
          href: '/tools/risk-reward-calculator',
          destinationType: 'calculator',
          label: 'Risk/reward calculator',
          description: 'Check what win rate a gold setup needs before you take it.',
        },
        {
          href: '/integrations/metatrader-5',
          destinationType: 'product',
          label: 'MetaTrader 5 import',
          description: 'Bring your XAUUSD history in from an MT5 statement.',
        },
      ]}
    >
      <ToolSection title="Why gold sizing trips people up">
        <p>
          Most gold sizing mistakes come from unit confusion. Traders think about gold in whole
          dollars — &ldquo;my stop is five dollars&rdquo; — but pip-based calculators expect a pip,
          and for XAUUSD a pip is usually $0.10. Enter 5 where the tool wanted 50 and the position
          comes out ten times too small; enter it the other way and it is ten times too large.
        </p>
        <p>
          This calculator sidesteps that by letting you enter the stop in whichever unit you
          actually think in, and converting it for you.
        </p>
      </ToolSection>

      <ToolSection title="The formula, with gold's contract size">
        <p>
          One standard lot of XAUUSD is {GOLD.contractSize} troy ounces. So a $1 move in the gold
          price is ${GOLD.contractSize} per standard lot — which is all the calculation needs.
        </p>
        <Formula>{`risk amount  = balance × risk %
loss per lot = stop distance in $ × ${GOLD.contractSize} oz
position     = risk amount ÷ loss per lot`}</Formula>
      </ToolSection>

      <ToolSection title="A worked example">
        <p>A $20,000 account, risking 1%, with a stop $5.00 away from entry:</p>
        <Formula>{`risk amount  = 20,000 × 1%     = $200
loss per lot = 5.00 × ${GOLD.contractSize}        = $500
position     = 200 ÷ 500       = 0.40 lots`}</Formula>
        <p>
          Gold moving $5 against 0.40 lots costs $200 — the 1% that was budgeted. If the same
          account used a $10 stop, the position would halve to 0.20 lots and the risk would stay
          $200.
        </p>
      </ToolSection>

      <ToolSection title="Assumptions">
        <p>
          {GOLD.contractSize} ounces per standard lot is the common retail gold contract, but it is
          a convention rather than a law — some brokers differ, especially on cent and micro
          accounts. Check yours. The result assumes a USD-denominated account, since XAUUSD is
          quoted in {GOLD.quoteCurrency}; on a non-USD account the figure is in dollars and needs
          converting.
        </p>
        <p>
          Spread, commission and swap are excluded, and gold spreads widen around news and the
          session roll. Sizes are rounded <strong>down</strong> to 0.01 lots so the position never
          exceeds the risk you asked for.
        </p>
      </ToolSection>

      <ToolSection title="Gold is volatile, and sizing is where that is handled">
        <p>
          Gold routinely moves more in a session than a major FX pair does in a week. That is not an
          argument for trading it smaller as a rule — it is an argument for the stop distance, and
          therefore the position size, being decided before the trade rather than during it.
        </p>
      </ToolSection>
    </ToolLayout>
  );
}

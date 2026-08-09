import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import { MetatraderPage } from '@/features/marketing/components/metatrader-page';

export const metadata: Metadata = metadataFor('/integrations/metatrader-5');

export default function MetaTrader5Page() {
  return (
    <MetatraderPage
      path="/integrations/metatrader-5"
      adapterId="mt5"
      title="MT5 trading journal — import your MetaTrader 5 history"
      lede="Export your MetaTrader 5 history as a CSV statement and import it with column mapping, a dry-run preview and de-duplication. File import only — no broker credentials, ever."
      logo="/images/platforms/metatrader-5.png"
      exportSteps={[
        'Open MetaTrader 5 and go to the Toolbox panel (Ctrl+T), then the History tab.',
        'Right-click inside the history grid and choose the period you want — Last Month, Last 3 Months or a custom range.',
        'Right-click again and choose Report, then save it as a CSV file rather than the default HTML.',
        'Note where the file was saved. That is the file MetaTradee reads.',
      ]}
      platformNotes={[
        'MT5 labels the opening timestamp simply "Time"; the MT5 mapping recognises it alongside the more explicit "Open Time".',
        'MT5 statements often use a bare "Price" column for the entry; that is recognised too.',
        'Volume is reported in lots, and is mapped to quantity.',
        'MT5 is hedging- or netting-mode depending on the account; either exports fine, but a netting account reports position-level rows rather than one row per ticket.',
      ]}
      faqs={[
        {
          q: 'Does MetaTradee connect to my MT5 account automatically?',
          a: 'No. There is no automatic sync and no API connection. You export a statement from MetaTrader 5 and upload the file. MetaTradee never asks for your login, investor password or broker API key.',
        },
        {
          q: 'Which file format should I export?',
          a: 'CSV. MetaTrader offers an HTML report by default, and HTML will not parse. If your saved file opens as a web page, re-export it as CSV.',
        },
        {
          q: 'What happens if I import overlapping periods?',
          a: 'Duplicates are detected by content hash — against both your existing trades and other rows inside the same file — and are flagged in the preview before anything is written.',
        },
        {
          q: 'Are my MT5 P&L figures used directly?',
          a: 'No. P&L, R multiple and risk-reward are recomputed on the server from entry, exit, quantity and fees, using the same engine as a manually logged trade, so every figure reconciles across the app.',
        },
        {
          q: 'Do I need a paid plan to import from MT5?',
          a: 'Yes. Statement import is a paid feature. The free plan covers manual journalling so you can try the routine before paying.',
        },
        {
          q: 'Can I backtest my MT5 strategy here?',
          a: 'No. Backtesting is not available on any plan. What ships is trade replay, which steps through real recorded sessions bar by bar.',
        },
      ]}
    />
  );
}

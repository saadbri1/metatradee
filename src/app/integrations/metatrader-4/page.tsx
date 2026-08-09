import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import { MetatraderPage } from '@/features/marketing/components/metatrader-page';

export const metadata: Metadata = metadataFor('/integrations/metatrader-4');

export default function MetaTrader4Page() {
  return (
    <MetatraderPage
      path="/integrations/metatrader-4"
      adapterId="mt4"
      title="MT4 trading journal — import your MetaTrader 4 history"
      lede="Export your MetaTrader 4 account history as a CSV statement and import it with MT4-aware column mapping, a dry-run preview and de-duplication. File import only — no broker credentials, ever."
      logo="/images/platforms/metatrader-4.png"
      exportSteps={[
        'Open MetaTrader 4 and go to the Terminal panel (Ctrl+T), then the Account History tab.',
        'Right-click inside the history grid and choose the period you want — All History, or a custom range.',
        'Right-click again and choose Save as Report, then save it as CSV rather than the default HTML.',
        'Note where the file was saved. That is the file MetaTradee reads.',
      ]}
      platformNotes={[
        'MT4 calls the instrument column "Item" rather than "Symbol"; the MT4 mapping recognises both.',
        'MT4 reports size in "Lots", which is mapped to quantity.',
        'MT4 uses "Open Time" and "Close Time" explicitly, which map straight through.',
        'MT4 is always hedging-style, so each ticket is its own row — one row per trade, which maps cleanly.',
      ]}
      faqs={[
        {
          q: 'Does MetaTradee connect to my MT4 account automatically?',
          a: 'No. There is no automatic sync and no API connection. You export a statement from MetaTrader 4 and upload the file. MetaTradee never asks for your login, investor password or broker API key.',
        },
        {
          q: 'Which file format should I export?',
          a: 'CSV. MetaTrader 4 saves reports as HTML by default, and HTML will not parse. If your saved file opens as a web page, re-export it as CSV.',
        },
        {
          q: 'My columns are named differently from MT5. Does that matter?',
          a: 'No. The MT4 mapping knows MT4’s own vocabulary — "Item" for the instrument and "Lots" for size — so those are recognised without you renaming anything.',
        },
        {
          q: 'Will re-importing duplicate my trades?',
          a: 'No. Every row is fingerprinted by content hash and checked against both your existing trades and other rows in the same file, then flagged in the preview.',
        },
        {
          q: 'Do I need a paid plan to import from MT4?',
          a: 'Yes. Statement import is a paid feature. The free plan covers manual journalling so you can try the routine first at no cost.',
        },
        {
          q: 'Does MetaTradee support MT4 Expert Advisors or automated strategies?',
          a: 'Only in the sense that trades placed by an EA appear in the account history like any other trade and import normally. MetaTradee does not run, connect to or control an EA.',
        },
      ]}
    />
  );
}

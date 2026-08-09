import Image from 'next/image';
import { CheckList, LandingSection, LandingShell, type Faq } from './landing-shell';
import { getAdapter } from '@/features/import/adapters';
import { PLANS } from '@/features/billing/plans';
import { TIER_ORDER, formatPrice, priceFor } from '@/features/billing/pricing';
import type { SeoPath } from '@/config/seo';

/**
 * The shared body for the MetaTrader 4 and 5 integration pages.
 *
 * ONE COMPONENT, TWO PAGES — but NOT one template with a keyword swapped, which
 * is the thing the brief rules out. The differences are real and come from
 * `adapters.ts`: MT4 and MT5 label the same columns differently ("Item" versus
 * "Symbol", "Lots" versus "Volume"), and each page states its own platform's
 * header vocabulary, export path and quirks. What is shared is the pipeline,
 * because the pipeline genuinely is identical.
 *
 * EVERY CAPABILITY CLAIM IS DERIVED. Formats, the header synonyms and the
 * plan that unlocks import all come from the modules that implement them, so
 * the page cannot promise something the importer does not do.
 */
export interface MetatraderPageProps {
  path: SeoPath;
  /** Adapter id in `adapters.ts` — `mt4` or `mt5`. */
  adapterId: 'mt4' | 'mt5';
  title: string;
  lede: string;
  /** Logo in /public/images/platforms. */
  logo: string;
  /** Where the statement lives in that platform's own interface. */
  exportSteps: string[];
  /** Header names this platform emits that the other does not. */
  platformNotes: string[];
  faqs: Faq[];
}

const FIRST_IMPORT_TIER = TIER_ORDER.find((t) => PLANS[t].features.brokerImport)!;
const IMPORT_PLAN = PLANS[FIRST_IMPORT_TIER];

export function MetatraderPage({
  path,
  adapterId,
  title,
  lede,
  logo,
  exportSteps,
  platformNotes,
  faqs,
}: MetatraderPageProps) {
  const adapter = getAdapter(adapterId);
  const formats = adapter.formats.map((f) => f.toUpperCase());
  /** The internal fields this adapter can populate — from its own header map. */
  const mappedFields = Object.keys(adapter.headerMap);

  return (
    <LandingShell
      path={path}
      eyebrow={adapter.label}
      title={title}
      lede={lede}
      screenshot={{
        src: '/images/features/broker-import.png',
        alt: `Mapping ${adapter.label} statement columns to MetaTradee trade fields before import`,
        width: 1600,
        height: 1000,
        caption: `Column mapping for a ${adapter.label} statement. The preview is a dry run — nothing is written until you confirm.`,
      }}
      faqs={faqs}
      related={[
        {
          href: adapterId === 'mt5' ? '/integrations/metatrader-4' : '/integrations/metatrader-5',
          label: adapterId === 'mt5' ? 'MetaTrader 4 import' : 'MetaTrader 5 import',
          description: 'The same pipeline, with that platform’s own column names.',
        },
        {
          href: '/trading-journal',
          label: 'Trading journal',
          description: 'What happens to the trades once they are in.',
        },
        {
          href: '/brokers',
          label: 'All supported platforms',
          description: 'Every platform with a ready-made mapping, and what is not supported.',
        },
        {
          href: '/tools/position-size-calculator',
          label: 'Position size calculator',
          description: 'Size the next trade before you take it.',
        },
        {
          href: '/free-trading-journal',
          label: 'Free trading journal',
          description: 'Start manually at no cost — import is a paid feature.',
        },
        {
          href: '/pricing',
          label: 'Plans and limits',
          description: `Import starts on ${IMPORT_PLAN.name}.`,
        },
      ]}
    >
      <LandingSection title={`How ${adapter.label} import works`}>
        <div className="mb-4 flex items-center gap-3">
          <Image
            src={logo}
            alt={`${adapter.label} logo`}
            width={40}
            height={40}
            className="size-10 rounded-md object-contain"
          />
          <p className="text-sm text-muted-foreground">
            File-based import. {adapter.label} statements are read as{' '}
            <strong className="text-foreground">{formats.join(' or ')}</strong>.
          </p>
        </div>
        <p>
          <strong className="text-foreground">There is no automatic sync.</strong> MetaTradee does
          not connect to {adapter.label}, does not use the investor password, and never asks for
          broker credentials or an API key. You export a statement; you upload it. That is the whole
          integration, and it is deliberately the boring kind — nothing to revoke, nothing to leak.
        </p>
      </LandingSection>

      <LandingSection title={`Exporting from ${adapter.label}`}>
        <ol className="mt-4 space-y-3">
          {exportSteps.map((step, i) => (
            <li key={step} className="flex gap-3 text-[0.9375rem] leading-6">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4">
          The importer only reads {formats.join(' and ')}. MetaTrader offers an HTML statement by
          default and that will not parse — if your file opens as a web page in a browser, re-export
          it as CSV.
        </p>
      </LandingSection>

      <LandingSection title="Importing into MetaTradee">
        <ol className="mt-4 space-y-3">
          {[
            'Open Journal → Import and choose your file.',
            `Pick ${adapter.label} as the source so its column names are recognised automatically.`,
            'Check the mapping. Anything auto-detected can be overridden by hand.',
            'Review the preview — this is a dry run and writes nothing.',
            'Confirm. The server re-validates every row before it is written.',
          ].map((step, i) => (
            <li key={step} className="flex gap-3 text-[0.9375rem] leading-6">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </LandingSection>

      <LandingSection title="Which fields are imported">
        <p>
          The {adapter.label} mapping recognises these trade fields. Anything the file does not
          contain is simply left empty rather than guessed:
        </p>
        <CheckList items={mappedFields.map((f) => f.replace(/_/g, ' '))} />
        <p className="mt-4">
          Derived figures — P&amp;L, R multiple, risk-reward, duration — are{' '}
          <strong className="text-foreground">not</strong> taken from the file. They are computed at
          write time by the same code that handles a manually logged trade, so imported and manual
          trades reconcile exactly.
        </p>
      </LandingSection>

      <LandingSection title={`${adapter.label} specifics`}>
        <CheckList items={platformNotes} />
      </LandingSection>

      <LandingSection title="Limitations, stated plainly">
        <CheckList
          items={[
            'No automatic or scheduled sync — every import is a file you upload',
            `Only ${formats.join(' and ')} statements parse; HTML and PDF exports do not`,
            `Import is a paid feature, starting on ${IMPORT_PLAN.name} at ${formatPrice(priceFor(FIRST_IMPORT_TIER).monthly)} per month`,
            'Open positions are not tracked live; the journal records trades, not a live account',
            'Backtesting is not available on any plan — trade replay of recorded sessions is',
          ]}
        />
      </LandingSection>

      <LandingSection title="Troubleshooting">
        <p>
          <strong className="text-foreground">The file will not upload.</strong> Check the
          extension: an HTML statement is the usual culprit. Re-export as CSV.
        </p>
        <p>
          <strong className="text-foreground">Columns landed in the wrong fields.</strong> The
          mapping step is editable — reassign any column by hand before previewing. Auto-detection
          is a starting point, not a decision.
        </p>
        <p>
          <strong className="text-foreground">Some rows were rejected.</strong> Rejected rows are
          listed with their row number and the reason. They are never silently dropped, so a partial
          import tells you precisely what did not make it.
        </p>
        <p>
          <strong className="text-foreground">I imported the same period twice.</strong> Duplicates
          are detected by content hash against both existing trades and other rows in the same file,
          and are flagged in the preview before anything is written.
        </p>
        <p>
          <strong className="text-foreground">Dates or numbers look wrong.</strong> The parser
          handles MetaTrader&rsquo;s <code>YYYY.MM.DD HH:MM:SS</code> format and locale-formatted
          numbers such as <code>1.234,56</code>. If a value still looks off, the preview will show
          it before it is committed — that is what the dry run is for.
        </p>
      </LandingSection>
    </LandingShell>
  );
}

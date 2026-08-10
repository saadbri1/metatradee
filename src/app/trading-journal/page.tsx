import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import {
  CheckList,
  LandingSection,
  LandingShell,
} from '@/features/marketing/components/landing-shell';
import { ADAPTERS } from '@/features/import/adapters';
import { PLANS } from '@/features/billing/plans';

export const metadata: Metadata = metadataFor('/trading-journal');

/** Derived from the import engine so the claim cannot drift from the code. */
const FORMATS = [...new Set(ADAPTERS.flatMap((a) => a.formats))].map((f) => f.toUpperCase());
const PLATFORMS = ADAPTERS.filter((a) => a.id !== 'generic').map((a) => a.label);

export default function TradingJournalPage() {
  return (
    <LandingShell
      path="/trading-journal"
      eyebrow="Trading journal"
      title="A trading journal where the numbers reconcile"
      lede="Log or import your trades and get gross P&L, net P&L and the planned reward-to-risk ratio computed on the server from one engine — so the figure in your journal is the same figure in your analytics and your reports."
      /*
       * No screenshot: the asset previously used here was a mock-up that
       * advertised file types and limits the importer does not support. See
       * the note in `metatrader-page.tsx`. `LandingShell` renders without one.
       */
      faqs={[
        {
          q: 'Does MetaTradee connect to my broker automatically?',
          a: `No. Import is file-based: you export a statement from your platform and upload it as ${FORMATS.join(' or ')}. There is no automatic broker sync, and no credentials are ever requested.`,
        },
        {
          q: 'Which platforms are supported?',
          a: `Ready-made column mappings exist for ${PLATFORMS.join(', ')}, plus a generic mapping for any other ${FORMATS.join('/')} statement.`,
        },
        {
          q: 'Will re-importing the same file duplicate my trades?',
          a: 'No. Every row is fingerprinted by content hash, and matches against both existing trades and other rows in the same file are flagged before anything is written.',
        },
        {
          q: 'Are imported trades calculated differently from manual ones?',
          a: 'No. Derived figures are computed at write time by the same code for both, so imported and manually logged trades reconcile by construction.',
        },
        {
          q: 'Can I start without paying?',
          a: `Yes. The Free plan needs no card and covers ${PLANS.free.limits.maxTrades} trades on one account. Broker import is on the paid plans.`,
        },
      ]}
      related={[
        {
          href: '/ai-trading-journal',
          label: 'AI trading journal',
          description: 'What the AI coach reviews, and the things it deliberately will not do.',
        },
        {
          href: '/free-trading-journal',
          label: 'Free trading journal',
          description: 'Exactly what the free plan includes, and what it does not.',
        },
        {
          href: '/integrations/metatrader-5',
          label: 'MetaTrader 5 import',
          description: 'Step-by-step MT5 statement export and column mapping.',
        },
        {
          href: '/tools/position-size-calculator',
          label: 'Position size calculator',
          description: 'Size a trade before you take it, then journal what happened.',
        },
        {
          href: '/products',
          label: 'Every module',
          description: 'Analytics, calendar, playbooks, psychology, replay and reports.',
        },
        {
          href: '/pricing',
          label: 'Plans and limits',
          description: 'Four plans with every limit stated before you commit.',
        },
      ]}
    >
      <LandingSection title="One calculation engine, not three">
        <p>
          The failure mode of most journals is quiet disagreement: the P&amp;L on a trade, the win
          rate on a dashboard and the figure in an exported report are computed in three different
          places and drift apart. MetaTradee computes gross P&amp;L, net P&amp;L and the planned
          reward-to-risk ratio <strong className="text-foreground">once, on the server</strong>,
          from one definition. Every screen reads that result. A realised R-multiple is not among
          them — reward-to-risk describes the plan, and the two are not interchangeable.
        </p>
        <p>
          Money is stored in exact-numeric types rather than floating point, so repeated arithmetic
          does not accumulate the fractional-cent drift that makes a year-end total disagree with
          the sum of its trades.
        </p>
      </LandingSection>

      <LandingSection title="Getting trades in">
        <p>
          Two routes, and they end in the same place. Log a trade by hand — entry, exit, quantity,
          fees, context — or import a statement you exported from your platform.
        </p>
        <CheckList
          items={[
            `Statements import as ${FORMATS.join(' or ')} files`,
            `Ready-made column mappings for ${PLATFORMS.join(', ')}`,
            'A generic mapping for any other statement, with columns you assign yourself',
            'Delimiter, locale-formatted numbers and platform date formats detected automatically',
            'Malformed rows are captured with their row number and the reason, never silently dropped',
          ]}
        />
        <p>
          <strong className="text-foreground">It is file import, not broker sync.</strong> You
          export the file; MetaTradee never asks for broker credentials, an investor password or an
          API key, because it never connects to your account.
        </p>
      </LandingSection>

      <LandingSection title="The import runs as a dry run first">
        <p>
          Upload, map columns, then <strong className="text-foreground">preview</strong>. The
          preview is the dry run — it validates every row against the same schema the journal uses,
          shows what would be written, flags duplicates, and writes nothing. You confirm, and only
          then does anything land. The server re-validates on commit, so a tampered client cannot
          bypass it.
        </p>
        <p>
          Duplicates are caught by content hash, against both your existing trades and other rows in
          the same file. Re-importing an overlapping statement is safe.
        </p>
      </LandingSection>

      <LandingSection title="Reviewing, not just recording">
        <p>
          A journal that only stores rows is a spreadsheet with extra steps. Trades carry tags,
          notes and screenshots; the calendar breaks results down by day, session and hour with
          timezone and DST handled; playbooks are versioned and become immutable once used, so
          adherence is measured against the rules that actually applied at the time.
        </p>
        <p>
          Psychology entries record the emotions and habits around a trade and feed a transparent
          discipline score that rewards process rather than profit. Those entries are private by
          construction and are never shown to workspace admins without your explicit opt-in.
        </p>
      </LandingSection>

      <LandingSection title="Your data stays yours">
        <p>
          Every record is scoped to you by row-level security in the database — not by a filter in
          application code that a bug could skip. Reports are shareable only when you choose to
          share one, and report sharing is withheld during a trial so a link cannot outlive it.
        </p>
      </LandingSection>

      <LandingSection title="What is not built yet">
        <p>
          Backtesting is not available — neither manual nor automated — and it is not sold as part
          of any plan. What ships is <strong className="text-foreground">trade replay</strong>,
          which steps through real recorded sessions bar by bar. Prop-firm rule monitoring is also
          not built. Saying so here is cheaper for both of us than a refund request later.
        </p>
      </LandingSection>
    </LandingShell>
  );
}

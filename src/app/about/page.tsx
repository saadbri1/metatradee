import type { Metadata } from 'next';
import Link from 'next/link';
import { metadataFor } from '@/config/seo';
import { PageHero, PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import { COMPANY_EMAILS } from '@/config/contact';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = metadataFor('/about');

/**
 * The entity page: what MetaTradee is, stated once, in the form a machine can
 * quote without reading the rest of the site.
 *
 * WHY THIS PAGE EXISTS. Everything else on the public site describes a FEATURE.
 * Nothing described the THING — and "what is MetaTradee" is the question an
 * answer engine has to resolve before it can decide whether to recommend it for
 * anything. When no page answers it plainly, a summariser assembles one from
 * marketing copy, and the two most common wrong conclusions are that this
 * product connects to a broker and that it backtests. Both are corrected here,
 * in the same words used in the FAQ, `/brokers` and `llms.txt`.
 *
 * ANSWER-FIRST STRUCTURE. Each H2 is a question; the paragraph immediately
 * under it answers that question in one to three sentences and is written to
 * survive being lifted out of the page on its own. No pronoun in a first
 * sentence refers to anything above it. That is the whole formatting rule.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT CONTAIN. No founder story, no team, no
 * company history, no funding, no user counts, no launch date, no awards. None
 * of that is recorded anywhere in this repository, and an About page is exactly
 * where invented corporate detail looks most credible and does the most damage.
 * The legal-entity and jurisdiction details belong here once the operator
 * supplies them; until then their absence is the honest state.
 */

/** Q&A blocks. One question, one self-contained answer. */
const ANSWERS: { q: string; id: string; a: string[] }[] = [
  {
    q: 'What is MetaTradee?',
    id: 'what-is-metatradee',
    a: [
      `${siteConfig.name} is a web-based trading journal and performance-analytics platform for retail traders. Traders import their completed trade history as a statement file, or log trades by hand, and MetaTradee computes the derived figures from that history: gross and net profit and loss, the planned reward-to-risk ratio, win rate, profit factor, expectancy and drawdown.`,
      'It is a record-keeping and review tool. It does not place trades, it does not connect to a live brokerage account, and it does not provide financial advice.',
    ],
  },
  {
    q: 'Who is MetaTradee for?',
    id: 'who-it-is-for',
    a: [
      'MetaTradee is built for individual retail traders who already trade and want to review what they did — forex, futures, metals, indices and equities, across discretionary and rule-based approaches. It also supports trading coaches reviewing a student’s numbers, and small teams working in a shared workspace where personal notes stay private.',
      'It is not a signal service, a copy-trading platform, a broker, or a strategy marketplace.',
    ],
  },
  {
    q: 'What problem does it solve?',
    id: 'problem',
    a: [
      'A spreadsheet journal stores whatever a trader types into it, and every derived figure is a formula that trader maintains by hand. The figures drift, the definitions differ between tabs, and floating-point arithmetic quietly disagrees with itself.',
      'MetaTradee computes every derived figure on the server from a single calculation engine using exact-numeric money, so the journal, the analytics and the reports cannot disagree with each other. Re-imported trades are de-duplicated by content hash rather than trusting a broker ticket number.',
    ],
  },
  {
    q: 'How does MetaTradee get trade data?',
    id: 'data-import',
    a: [
      'By file import only. A trader exports a statement from their platform as CSV or JSON and uploads it; MetaTradee maps the columns, shows a preview before anything is written, and de-duplicates on re-import. Dedicated importers recognise the column names used by MetaTrader 4, MetaTrader 5, cTrader, DXtrade, Match-Trader and TradeLocker, and any other platform works through a generic column mapper.',
      'There is no broker API connection, and MetaTradee never asks for trading credentials or an account password. Automatic broker synchronisation is designed for but not built, and is listed as unsupported rather than advertised as available.',
    ],
  },
  {
    q: 'How are the numbers calculated?',
    id: 'how-numbers-work',
    a: [
      'Every derived figure comes from one server-side calculation engine, never from the browser and never from a stored value a client could influence. Win rate is wins divided by decided trades. Profit factor is gross profit divided by gross loss. Expectancy is net profit and loss divided by decided trades. Reward-to-risk describes the plan, computed before the outcome is known.',
      'Where a figure cannot be computed — profit factor with no losing trades yet, for instance — MetaTradee displays an em dash rather than a misleading zero. A realised R-multiple is a different figure from planned reward-to-risk and is not currently computed.',
    ],
  },
  {
    q: 'How is product information on this site kept accurate?',
    id: 'editorial-policy',
    a: [
      'Public claims are generated from the code that implements them rather than written separately. The list of supported platforms on /brokers is derived from the import adapters themselves, plan pricing is derived from the billing configuration, and the sitemap and canonical URLs are derived from one route registry. A capability that ships changes those sources; a capability that does not ship cannot be described as available.',
      'Automated tests enforce the parts that a human would otherwise let drift, including that no structured-data markup describes content absent from the visible page, and that no rating, review count or award appears anywhere in that markup. Unreleased features are labelled as not yet supported on the pages that mention them.',
    ],
  },
  {
    q: 'How is trading data kept private?',
    id: 'privacy',
    a: [
      'Trading data is scoped to its owner with database row-level security, which is enforced by the database itself rather than by application code that could be bypassed. Psychology entries and personal notes are private by construction and are not exposed to workspace administrators without the author’s explicit opt-in.',
      'MetaTradee does not sell trading data and does not publish individual trader results.',
    ],
  },
];

export default function AboutPage() {
  return (
    <PublicShell>
      <PageHero
        path="/about"
        eyebrow="About"
        title="What MetaTradee is"
        lede="A trading journal and performance-analytics platform for retail traders — what it does, how the numbers are produced, and what it deliberately does not do."
      />

      {ANSWERS.map((block) => (
        <PageSection key={block.id} id={block.id} title={block.q}>
          <div className="max-w-3xl space-y-4 text-base leading-7 text-muted-foreground">
            {block.a.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        </PageSection>
      ))}

      <PageSection title="Contact" lede="Questions about the product, the company, or this page.">
        <div className="max-w-3xl space-y-4 text-base leading-7 text-muted-foreground">
          <p>
            General enquiries go to{' '}
            <a
              className="text-foreground underline underline-offset-4"
              href={`mailto:${COMPANY_EMAILS.contact}`}
            >
              {COMPANY_EMAILS.contact}
            </a>
            , support requests to{' '}
            <a
              className="text-foreground underline underline-offset-4"
              href={`mailto:${COMPANY_EMAILS.support}`}
            >
              {COMPANY_EMAILS.support}
            </a>
            , and company or press enquiries to{' '}
            <a
              className="text-foreground underline underline-offset-4"
              href={`mailto:${COMPANY_EMAILS.info}`}
            >
              {COMPANY_EMAILS.info}
            </a>
            .
          </p>
          <p>
            The{' '}
            <Link className="text-foreground underline underline-offset-4" href="/products">
              product pages
            </Link>{' '}
            describe each module in detail,{' '}
            <Link className="text-foreground underline underline-offset-4" href="/brokers">
              supported brokers
            </Link>{' '}
            lists every platform that can be imported today, and{' '}
            <Link className="text-foreground underline underline-offset-4" href="/pricing">
              pricing
            </Link>{' '}
            states what each plan includes. The{' '}
            <Link className="text-foreground underline underline-offset-4" href="/tools">
              free calculators
            </Link>{' '}
            are usable without an account.
          </p>
        </div>
      </PageSection>
    </PublicShell>
  );
}

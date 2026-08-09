import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import Link from 'next/link';
import { PageHero, PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import { PRODUCT_ITEMS } from '@/features/marketing/navigation';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = metadataFor('/products');

/**
 * What each module actually does. Every id here matches a `#anchor` in the
 * Products dropdown, so no menu item lands on a missing section.
 */
const DETAIL: Record<string, { id: string; points: string[] }> = {
  'Trading Dashboard': {
    id: 'dashboard',
    points: [
      'Net P&L, profit factor, win rate and expectancy across your accounts',
      'Cumulative and daily P&L, plus a month-at-a-glance calendar',
      'Open positions and recent trades side by side',
      'Choose which widgets appear and in what order',
    ],
  },
  'Trading Journal': {
    id: 'journal',
    points: [
      'P&L, R multiple and risk-reward computed on the server from one definition',
      'Exact-numeric money — no floating-point drift',
      'Tags, mistakes, screenshots and notes on every trade',
      'Filter, sort and paginate a six-figure trade history without slowdown',
    ],
  },
  'Trade Analytics': {
    id: 'analytics',
    points: [
      'Win rate, profit factor, expectancy, average R and drawdown',
      'Breakdowns by symbol, setup, session, day of week and direction',
      'Equity curve and drawdown derived from the same engine as the journal',
      'Every figure reconciles with the trade it came from',
    ],
  },
  'Chart & Replay': {
    id: 'chart',
    points: [
      'Complete historical sessions at one-minute resolution',
      'Step forward and back through a session bar by bar',
      'Future candles stay hidden while you practise',
      'Place simulated orders against the replayed session',
    ],
  },
  Playbooks: {
    id: 'playbook',
    points: [
      'Entry, confirmation, invalidation, risk and exit rules in one place',
      'An ordered pre-trade checklist you can actually follow',
      'Versioned: editing a rule records a new version, history is kept',
      'Expectancy and profit factor measured from the trades you linked',
    ],
  },
  'AI Coach': {
    id: 'ai-coach',
    points: [
      'Reviews grounded in your own recorded trades',
      'Every insight links back to the evidence behind it',
      'No trade signals, no price predictions, no invented figures',
      'You decide what data a review may read',
    ],
  },
  Calendar: {
    id: 'calendar',
    points: [
      'Performance by day, session and hour of the day',
      'Timezone-correct and DST-aware',
      'Spot the sessions that genuinely pay you',
    ],
  },
  Reports: {
    id: 'reports',
    points: [
      'Compose a report from the metrics you care about',
      'Built from the same verified numbers as the rest of the app',
      'Share a read-only snapshot without exposing your account',
    ],
  },
};

export default function ProductsPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Products"
        title="Every part of your trading process, in one place"
        lede={`${siteConfig.name} is a connected set of modules — journal, analytics, replay, playbooks and an evidence-linked coach — all reading the same verified numbers.`}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/register"
            className="h-13 inline-flex items-center rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Get Started
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-xl border border-border px-8 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See plans
          </Link>
        </div>
      </PageHero>

      {PRODUCT_ITEMS.map((item) => {
        const detail = DETAIL[item.label]!;
        const Icon = item.icon!;
        return (
          <PageSection key={item.label} id={detail.id}>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <div>
                <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  {item.label}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <ul className="grid content-start gap-3 rounded-2xl border border-border/70 bg-card p-6">
                {detail.points.map((point) => (
                  <li key={point} className="flex gap-3 text-[0.9375rem] leading-6">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </PageSection>
        );
      })}
    </PublicShell>
  );
}

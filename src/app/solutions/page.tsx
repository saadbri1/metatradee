import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import Link from 'next/link';
import { PageHero, PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import { SOLUTION_ITEMS } from '@/features/marketing/navigation';

export const metadata: Metadata = metadataFor('/solutions');

/**
 * One section per Solutions menu item. `id` matches the `#anchor` used by the
 * dropdown, and every "modules used" entry names a shipped feature so a reader
 * can check the claim on the Products page.
 */
const DETAIL: Record<string, { id: string; body: string; modules: string[] }> = {
  'Active Traders': {
    id: 'active-traders',
    body: 'Build a repeatable routine: log the trade, tag the mistake, and check at the end of the week whether the thing you believe about your trading is actually true.',
    modules: ['Journal', 'Analytics', 'Calendar'],
  },
  'Futures Traders': {
    id: 'futures-traders',
    body: 'Session-aware analytics for instruments that behave differently at the open, through the middle of the day and into the close — with historical CME sessions you can replay minute by minute.',
    modules: ['Chart & Replay', 'Analytics', 'Calendar'],
  },
  'Funded Traders': {
    id: 'funded-traders',
    body: 'Keep several evaluation and funded accounts separate, watch drawdown per account, and record the rules you are required to follow so a breach is never a surprise.',
    modules: ['Dashboard', 'Journal', 'Playbooks'],
  },
  'Trading Coaches': {
    id: 'trading-coaches',
    body: 'Review a student against their recorded numbers rather than their recollection. Playbook adherence shows whether the plan was followed, separately from whether the trade won.',
    modules: ['Playbooks', 'Analytics', 'Reports'],
  },
  'Trading Teams': {
    id: 'trading-teams',
    body: 'Share strategies and reports across a team while personal psychology notes stay private by default. Access is owner-scoped at the database level, not just in the interface.',
    modules: ['Workspaces', 'Reports', 'Playbooks'],
  },
  'Demo & Replay Practice': {
    id: 'replay-practice',
    body: 'Rehearse a setup on real historical data without risking capital. Future candles stay hidden, so the session tests your decision rather than your memory.',
    modules: ['Chart & Replay', 'Simulated orders'],
  },
  'Performance Review': {
    id: 'performance-review',
    body: 'A weekly and monthly loop: mark trades reviewed, read the breakdowns by setup and session, and let the coach cite the evidence behind each observation.',
    modules: ['Analytics', 'AI Coach', 'Reports'],
  },
  'Strategy Development': {
    id: 'strategy-development',
    body: 'Write the rules down, link the trades you took under them, and watch expectancy and profit factor accumulate per playbook until the edge is demonstrated or disproved.',
    modules: ['Playbooks', 'Journal', 'Analytics'],
  },
};

export default function SolutionsPage() {
  return (
    <PublicShell>
      <PageHero
        path="/solutions"
        eyebrow="Solutions"
        title="Built around how traders actually work"
        lede="The same verified data serves very different routines. Here is how each of them fits together — and which modules do the work."
      >
        <Link
          href="/register"
          className="inline-flex items-center rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Get Started
        </Link>
      </PageHero>

      {SOLUTION_ITEMS.map((item) => {
        const detail = DETAIL[item.label]!;
        return (
          <PageSection key={item.label} id={detail.id}>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  {item.label}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  {detail.body}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card p-6">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Modules used
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {detail.modules.map((module) => (
                    <li
                      key={module}
                      className="rounded-full bg-primary/10 px-3 py-1.5 text-[0.8125rem] font-medium text-primary"
                    >
                      {module}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/products"
                  className="mt-5 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  See what each module does →
                </Link>
              </div>
            </div>
          </PageSection>
        );
      })}
    </PublicShell>
  );
}

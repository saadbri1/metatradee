import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import { RESOURCE_ITEMS } from '@/features/marketing/navigation';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'Guides for the MetaTradee journal, replay, analytics, playbooks and AI coach, plus help, product updates, security and contact details.',
  alternates: { canonical: '/resources' },
};

/**
 * Every Resources menu item resolves to something real — either a guide written
 * on this page, or another page that genuinely exists. There are no outbound
 * blog stubs and no "coming soon" articles dressed as links.
 *
 * Menu items that point AWAY from this page (the free calculators at /tools)
 * have no entry in `GUIDES` and render no section here. That case used to be a
 * `GUIDES[item.label]!` non-null assertion, which turned the first such item
 * into a build-time prerender crash — the assertion did not make the invariant
 * true, it only stopped the compiler asking about it.
 */
const GUIDES: Record<string, { id: string; body: string; steps?: string[] }> = {
  'Trading Journal Guide': {
    id: 'journal-guide',
    body: 'A journal is only useful if the numbers can be trusted. MetaTradee computes P&L, R multiple and risk-reward on the server from one definition, so the figure in your journal is the figure in your analytics.',
    steps: [
      'Record entry, exit, quantity and fees — the derived figures are calculated for you.',
      'Tag the setup and, honestly, the mistake. Mistake tags are what make later review useful.',
      'Mark a trade reviewed once you have actually looked at it again.',
      'Import history from your platform rather than retyping it.',
    ],
  },
  'Replay Guide': {
    id: 'replay-guide',
    body: 'Replay steps through a real historical session one bar at a time, with future candles hidden. It tests the decision you would have made, not the one you remember making.',
    steps: [
      'Load a session, then enter replay to hide everything after your chosen start.',
      'Play, pause, or step forward and back a single candle at a time.',
      'Place simulated orders as the session develops.',
      'Exit replay to see the complete session again.',
    ],
  },
  'Analytics Guide': {
    id: 'analytics-guide',
    body: 'Win rate is wins ÷ decided trades. Profit factor is gross profit ÷ gross loss. Expectancy is net P&L ÷ decided trades. Where a value cannot be computed — no losses yet, for instance — MetaTradee shows an em dash instead of a misleading zero.',
    steps: [
      'Filter by symbol, setup, session or direction to isolate a real pattern.',
      'Check the sample size before drawing a conclusion from a breakdown.',
      'Compare long and short performance separately; they often differ.',
    ],
  },
  'Playbook Guide': {
    id: 'playbook-guide',
    body: 'A playbook records the rules you actually trade: entry, confirmation, invalidation, risk, management and exit, plus a pre-trade checklist. Editing a rule creates a new version, so history is preserved.',
    steps: [
      'Write rules you can objectively check afterwards.',
      'Link your trades to the playbook you traded.',
      'Read expectancy and profit factor per playbook once the sample is meaningful.',
    ],
  },
  'AI Coach Guide': {
    id: 'ai-coach-guide',
    body: 'The coach reviews your recorded trades and links every observation to the evidence behind it. It does not predict prices, does not issue buy or sell calls, and does not invent figures. If the data does not support a claim, it says so.',
  },
  'Help Center': {
    id: 'help-center',
    body: 'Common questions: imports are de-duplicated by content hash, so re-uploading a statement will not double-count trades. Deleting a playbook never deletes trades. Your data is owner-scoped at the database level, not only in the interface.',
  },
  'Product Updates': {
    id: 'product-updates',
    body: 'Recent work: a rebuilt trade log with review state and tag filtering, a professional analytics workspace, complete one-minute chart sessions with replay, and a playbook workspace that measures each strategy against its linked trades. Automatic broker API sync is designed for but not yet built.',
  },
  'Security & Privacy': {
    id: 'security',
    body: 'Every table is protected by owner-scoped row-level security, so one account cannot read another account’s trades even if the interface were bypassed. MetaTradee never asks for your broker credentials. Private notes are excluded from shared surfaces by default.',
  },
  Contact: {
    id: 'contact',
    body: 'Missing a platform adapter, found a problem, or want to ask about early access? Reach the team and tell us which platform you trade on — adapter priority is driven by what people actually use.',
  },
};

export default function ResourcesPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Resources"
        title="Guides, answers and how things actually work"
        lede={`How to get the most out of ${siteConfig.name}, what each metric means, and what we do and do not do with your data.`}
      />

      <PageSection>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCE_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex h-full flex-col rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-base font-semibold text-foreground">{item.label}</span>
                <span className="mt-2 text-[0.9375rem] leading-6 text-muted-foreground">
                  {item.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PageSection>

      {RESOURCE_ITEMS.map((item) => {
        // No guide means the item links elsewhere; it gets a card above, not a
        // section here. Checked rather than asserted.
        const guide = GUIDES[item.label];
        if (!guide) return null;
        return (
          <PageSection key={item.label} id={guide.id} title={item.label}>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">{guide.body}</p>
            {guide.steps ? (
              <ul className="mt-6 grid max-w-3xl gap-3">
                {guide.steps.map((step) => (
                  <li key={step} className="flex gap-3 text-[0.9375rem] leading-6">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {guide.id === 'contact' ? (
              <Link
                href="/register"
                className="mt-6 inline-flex items-center rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Get Started
              </Link>
            ) : null}
          </PageSection>
        );
      })}
    </PublicShell>
  );
}

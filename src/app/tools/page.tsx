import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Calculator, Scale, Coins } from 'lucide-react';
import { PageSection, PublicShell } from '@/features/marketing/components/public-shell';
import { Breadcrumbs } from '@/features/marketing/components/breadcrumbs';
import { metadataFor } from '@/config/seo';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = metadataFor('/tools');

/**
 * The tools hub.
 *
 * IT LISTS WHAT EXISTS AND NOTHING ELSE. A hub advertising nine calculators
 * that resolve to three built ones and six empty pages is a worse page than one
 * listing three — and the six would be thin pages competing with the real ones.
 * More tools are planned; they get listed here when they work.
 */
const TOOLS = [
  {
    href: '/tools/position-size-calculator',
    icon: Calculator,
    name: 'Position size calculator',
    description:
      'How many lots a trade supports, from your balance, your risk percentage and your stop distance. Works for forex, metals, oil and indices.',
  },
  {
    href: '/tools/xauusd-lot-size-calculator',
    icon: Coins,
    name: 'XAUUSD lot size calculator',
    description:
      'Gold sizing with the contract size already filled in, and a stop you can enter in dollars or pips without converting it yourself.',
  },
  {
    href: '/tools/risk-reward-calculator',
    icon: Scale,
    name: 'Risk/reward calculator',
    description:
      'Entry, stop and target into a ratio — plus the win rate that ratio has to beat before the setup makes money.',
  },
];

export default function ToolsPage() {
  return (
    <PublicShell>
      <section className="border-b border-border/70 bg-gradient-to-b from-accent/45 to-background">
        <div className="mx-auto max-w-[1480px] px-6 py-16 sm:px-10 lg:px-14 lg:py-20">
          <Breadcrumbs path="/tools" />
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Free tools
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Free trading calculators
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Sizing and risk calculators that work in the browser, with no account, no email wall and
            no hidden result. Every one shows the formula it used and states what it assumes.
          </p>
        </div>
      </section>

      <PageSection title="Calculators">
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-colors duration-fast hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <tool.icon className="size-5" aria-hidden />
                </span>
                <span className="mt-4 font-display text-lg font-semibold text-foreground">
                  {tool.name}
                </span>
                <span className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {tool.description}
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Open calculator
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        title="Why these are free and ungated"
        lede="A calculator that asks for an email before showing a number is not a tool, it is a form."
      >
        <div className="max-w-3xl space-y-4 text-base leading-7 text-muted-foreground">
          <p>
            Each of these does one calculation completely, in the open, with the formula printed on
            the page. You can check the arithmetic by hand — and you should, at least once, because
            a sizing calculator you have not verified is a number you are trusting blindly with your
            account.
          </p>
          <p>
            They are also honest about their limits. None of them converts currencies at an invented
            exchange rate, none includes spread or commission, and each says so on its own page
            rather than quietly rolling an assumption into the answer.
          </p>
          <p>
            What a calculator cannot do is tell you whether you <em>followed</em> it. That needs the
            trades you actually took, which is what {siteConfig.name} is for.
          </p>
        </div>
      </PageSection>
    </PublicShell>
  );
}

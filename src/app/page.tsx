import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Bot,
  HeartHandshake,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { siteConfig } from '@/config/site';
import { PLANS, type PlanTier } from '@/features/billing/plans';

export const metadata: Metadata = {
  title: `${siteConfig.name} — AI Trading Journal & Performance Analytics`,
  description: siteConfig.description,
};

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Trading Journal',
    body: 'Log every trade with server-computed PnL, R multiple, and RR — exact-numeric, never guessed. Import from MT4/MT5, cTrader, and more.',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    body: 'Win rate, profit factor, expectancy, equity curve, and drawdown from one calculation engine — every number reconciles across the app.',
  },
  {
    icon: CalendarDays,
    title: 'Calendar & Sessions',
    body: 'See which days, sessions, and hours you perform best — timezone-correct, DST-aware, with honest streaks.',
  },
  {
    icon: ClipboardList,
    title: 'Playbooks & Strategies',
    body: 'Document rules and checklists, version them immutably, and measure adherence against the strategy in force at trade time.',
  },
  {
    icon: Bot,
    title: 'AI Coach',
    body: 'Evidence-linked, constructive reviews — grounded in your real numbers, never invented. No buy/sell calls, ever.',
  },
  {
    icon: HeartHandshake,
    title: 'Psychology & Discipline',
    body: 'Track emotions, habits, and a transparent discipline score that rewards process, not volume. Private by design.',
  },
] as const;

const PRICING_TIERS: PlanTier[] = ['free', 'trader', 'pro', 'funded'];

function price(cents: number): string {
  return cents === 0 ? 'Free' : `$${Math.round(cents / 100)}`;
}

/** Decorative, token-driven dashboard preview (illustrative — no real figures). */
function DashboardPreview() {
  return (
    <div
      aria-hidden
      className="mx-auto mt-14 w-full max-w-4xl rounded-xl border border-border bg-card p-4 shadow-2xl shadow-primary/5"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-loss/70" />
        <span className="size-2.5 rounded-full bg-muted-foreground/40" />
        <span className="size-2.5 rounded-full bg-profit/70" />
        <span className="ml-3 text-xs text-muted-foreground">metatradee.app/dashboard</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['Net P&L', 'Win rate', 'Profit factor', 'Avg R:R'].map((label, i) => (
          <div key={label} className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <div
              className={`mt-2 h-4 w-3/4 rounded ${i === 0 ? 'bg-profit/60' : 'bg-foreground/25'}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background p-4">
        <svg viewBox="0 0 400 120" className="h-28 w-full" role="presentation">
          <polyline
            points="0,100 50,88 100,92 150,70 200,74 250,52 300,40 350,30 400,18"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
          />
          <polygon
            points="0,100 50,88 100,92 150,70 200,74 250,52 300,40 350,30 400,18 400,120 0,120"
            fill="hsl(var(--primary) / 0.08)"
          />
        </svg>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2" aria-label={`${siteConfig.name} home`}>
            <span className="flex items-end gap-0.5" aria-hidden>
              <span className="h-2 w-6 translate-x-0.5 rounded-sm bg-primary" />
              <span className="h-2 w-6 rounded-sm bg-foreground" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              {siteConfig.name}
            </span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Primary">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="#features">Features</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="#pricing">Pricing</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-4 pt-16 text-center sm:pt-24">
          <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden />
            Evidence-based. Private by design. No fabricated numbers.
          </p>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            The AI trading journal that proves your edge with{' '}
            <span className="text-primary">verified data</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {siteConfig.description}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Start free <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free plan available · No credit card required
          </p>
          <DashboardPreview />
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Everything a serious trader needs
            </h2>
            <p className="mt-3 text-muted-foreground">
              One calculation engine behind every screen — the numbers you see always reconcile.
            </p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <Card className="h-full">
                  <CardContent className="p-5">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <f.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 font-medium">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Simple, honest pricing
            </h2>
            <p className="mt-3 text-muted-foreground">
              Start free. Upgrade when your journal proves it&apos;s worth it. Cancel anytime.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PRICING_TIERS.map((tier) => {
              const plan = PLANS[tier];
              const enabled = Object.entries(plan.features).filter(([, v]) => v);
              return (
                <Card key={tier} className={tier === 'pro' ? 'border-primary' : ''}>
                  <CardContent className="flex h-full flex-col p-5">
                    <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                    <p className="mt-2">
                      <span className="tabular text-3xl font-semibold">
                        {price(plan.priceMonthly)}
                      </span>
                      {plan.priceMonthly > 0 ? (
                        <span className="text-sm text-muted-foreground">/mo</span>
                      ) : null}
                    </p>
                    <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="size-4 text-primary" aria-hidden />
                        {plan.limits.maxTrades === null
                          ? 'Unlimited trades'
                          : `${plan.limits.maxTrades} trades`}
                      </li>
                      {enabled.slice(0, 4).map(([key]) => (
                        <li key={key} className="flex items-center gap-2">
                          <Check className="size-4 text-primary" aria-hidden />
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="mt-5 w-full" variant={tier === 'pro' ? 'default' : 'outline'}>
                      <Link href="/register">{tier === 'free' ? 'Start free' : `Choose ${plan.name}`}</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Prices shown for reference; billing is handled securely by our payment provider.
          </p>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="rounded-2xl border border-border bg-muted/30 px-6 py-12 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Journal the past. Guard the present.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Turn your trading history into a measurable edge — with analytics you can trust and a
              coach that only ever cites your own data.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  Create your free account <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {siteConfig.name}
          </span>
          <nav className="flex gap-4" aria-label="Footer">
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Sign up
            </Link>
            <Link href="#pricing" className="hover:text-foreground">
              Pricing
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

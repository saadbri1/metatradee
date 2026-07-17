import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { Reveal } from '../motion/reveal';
import { Magnetic } from './magnetic';
import { DashboardPreview } from './dashboard-preview';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Aurora background — layered token gradients, GPU-only slow drift, no
          layout impact and no effect on the LCP paint. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="aurora-drift absolute left-1/2 top-[-12%] h-[520px] w-[880px] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />
        <div className="aurora-drift absolute right-[8%] top-[6%] h-[320px] w-[420px] rounded-full bg-profit/5 blur-[110px]" />
      </div>

      {/* Hero text is rendered statically (no opacity gating) so the LCP element
          — the headline — paints immediately and is readable without JS. Only the
          decorative preview below animates in. */}
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-20 text-center sm:pt-28">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          Evidence-based · Private by design · No fabricated numbers
        </p>
        <h1 className="mx-auto mt-5 max-w-4xl text-balance font-display text-4xl font-semibold tracking-tight sm:text-6xl">
          The AI trading journal that proves your edge with{' '}
          <span className="text-primary">verified data</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
          {siteConfig.description}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Magnetic>
            <Button asChild size="lg">
              <Link href="/register">
                Start free <ArrowRight aria-hidden />
              </Link>
            </Button>
          </Magnetic>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Free plan · No credit card required</p>

        <Reveal delay={0.1} y={28}>
          <DashboardPreview className="mx-auto mt-14 max-w-4xl" />
        </Reveal>
      </div>
    </section>
  );
}

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
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
        <p
          className="hero-reveal mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
          style={{ '--hero-delay': '70ms' } as CSSProperties}
        >
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          Evidence-based · Private by design · No fabricated numbers
        </p>
        <h1
          className="hero-reveal mx-auto mt-5 max-w-4xl text-balance font-display text-4xl font-semibold tracking-tight sm:text-6xl"
          style={{ '--hero-delay': '130ms' } as CSSProperties}
        >
          The AI trading journal that proves your edge with{' '}
          <span className="text-primary">verified data</span>
        </h1>
        <p
          className="hero-reveal mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground"
          style={{ '--hero-delay': '200ms' } as CSSProperties}
        >
          {siteConfig.description}
        </p>
        <div
          className="hero-reveal mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ '--hero-delay': '270ms' } as CSSProperties}
        >
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
        <p
          className="hero-reveal mt-4 text-xs text-muted-foreground"
          style={{ '--hero-delay': '340ms' } as CSSProperties}
        >
          Free plan · No credit card required
        </p>

        <div className="product-preview-enter relative mx-auto mt-14 max-w-4xl">
          <DashboardPreview />
          <div
            aria-hidden
            className="idle-float absolute -left-3 top-16 hidden rounded-lg border border-border bg-background/95 px-3 py-2 text-left shadow-xl backdrop-blur sm:block"
            style={{ '--float-delay': '-900ms' } as CSSProperties}
          >
            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Data integrity
            </span>
            <strong className="mt-0.5 block text-xs text-profit">Import verified</strong>
          </div>
          <div
            aria-hidden
            className="idle-float absolute -right-4 bottom-20 hidden rounded-lg border border-border bg-background/95 px-3 py-2 text-left shadow-xl backdrop-blur sm:block"
            style={{ '--float-delay': '-2.4s' } as CSSProperties}
          >
            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Journal workflow
            </span>
            <strong className="mt-0.5 block text-xs text-primary">Review ready</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

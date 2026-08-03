import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Reveal } from '../motion/reveal';

/**
 * Centred product showcase for the replay workspace.
 *
 * ON THE HEADLINE CAPABILITY. This section was specified as "Backtesting &
 * Replay". Replay is real and shipped — src/features/replay/engine.ts, the
 * /chart Replay Terminal, and `tradeReplay` on the paid plans. BACKTESTING IS
 * NOT: features/billing/plans.ts declares it under COMING_SOON with the note
 * "Capabilities that DO NOT EXIST in the product yet… they may be shown as
 * 'Coming soon' and must never be presented as included in a paid plan, priced,
 * or gated as though they worked."
 *
 * So the composition, hierarchy and copy are as briefed, but backtesting
 * carries a visible "Coming soon" tag rather than being sold as shipped, and
 * the primary call to action points at the thing a visitor can actually use
 * today. The pricing page already lists these same items as "Coming soon", so
 * this is consistent with what the site says elsewhere rather than a new rule.
 *
 * The screenshot is the real Replay Terminal, not a mock.
 */

const PILLS = [
  { label: 'Replay', soon: false },
  { label: 'Improve', soon: false },
  { label: 'Backtesting', soon: true },
];

export function ReplayShowcaseSection() {
  return (
    <section
      id="replay"
      aria-labelledby="replay-heading"
      className="scroll-mt-20 border-t border-border/50"
    >
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
        {/* Ambient glow, matching the hero and final CTA. Decorative only. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-8 h-72 w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        </div>

        <Reveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Replay &amp; review
          </p>
          <h2
            id="replay-heading"
            className="mx-auto mt-3 max-w-3xl text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Take your edge one step further.
            <span className="mt-1 block text-primary">Replay. Review. Improve.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-muted-foreground">
            Step back through a real session bar by bar, watch the decisions you actually made, and
            work on execution in a focused environment built for deliberate improvement.
          </p>
        </Reveal>

        <Reveal delay={0.06} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">
              Explore the Replay Terminal <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </Reveal>

        <Reveal delay={0.12} className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {PILLS.map((pill) => (
            <span
              key={pill.label}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                pill.soon
                  ? 'border-dashed border-border text-muted-foreground'
                  : 'border-border bg-muted/40 text-foreground',
              )}
            >
              {pill.label}
              {/*
               * Says so on the pill itself rather than in a footnote. A
               * capability listed beside two shipped ones, with no marker,
               * reads as shipped.
               */}
              {pill.soon ? (
                <span className="rounded-full bg-muted px-1.5 py-px text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Coming soon
                </span>
              ) : null}
            </span>
          ))}
        </Reveal>

        {/* The screenshot is the hero of the section. */}
        <Reveal delay={0.18} y={24} className="mt-12">
          <figure className="m-0">
            <div
              /*
               * The frame takes the screenshot's own 1919x900 ratio, so the
               * image fills it exactly — no letterboxing, no distortion — and
               * the space is reserved before it loads, so nothing shifts.
               *
               * No fake browser chrome: the screenshot already contains the
               * product's own window, and the rest of this site frames
               * screenshots with a plain bordered card.
               */
              style={{ aspectRatio: '1919 / 900' }}
              className="relative overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_70px_-40px_hsl(var(--primary)/0.45)]"
            >
              <Image
                src="/images/landing/backtest-screen.png"
                /*
                 * Describes what the image ACTUALLY shows. The brief specified
                 * "MetaTradee backtesting interface preview", but this is the
                 * Replay Terminal — its own header says so — and alt text is
                 * the one place a wrong label is not merely marketing spin, it
                 * is the only description a screen-reader user ever gets.
                 */
                alt="The MetaTradee Replay Terminal, replaying a recorded one-minute ES futures session with candlesticks, volume and a trade-note panel."
                width={1919}
                height={900}
                /* Full content width; the frame never exceeds max-w-6xl (1152px). */
                sizes="(min-width: 1200px) 1120px, 100vw"
                className="h-full w-full object-contain object-center"
                loading="lazy"
              />
            </div>
            <figcaption className="mt-3 text-center text-xs text-muted-foreground">
              The Replay Terminal, replaying a real recorded session. Simulated orders stay in your
              browser session and never touch a broker.
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

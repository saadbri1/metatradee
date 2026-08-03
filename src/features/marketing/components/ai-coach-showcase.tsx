import { Check, Gauge, Scale, Sparkles, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Marketing preview of the MetaTradee AI Coach review.
 *
 * BUILT, NOT SCREENSHOT. HTML, SVG and design tokens — sharp on Retina, follows
 * the theme, reflows, stays editable.
 *
 * NOT THE REAL AI COACH. No shared component, prompt, model call or route with
 * the authenticated app. Nothing here is generated; the observations are
 * written copy.
 *
 * THE COPY IS THE CONSTRAINT, not the layout. The section this illustrates says
 * "Never a signal, never an invented number", and the real product's insights
 * are `narrative + evidence` where the numbers come from the evidence rather
 * than the model. So every observation below cites a specific, checkable fact
 * from the same fictional account, and none of them predicts anything or
 * promises a result. No "this will improve your returns" — that is exactly the
 * claim the product exists to avoid making.
 *
 * The reference image's copy was malformed and was not reproduced.
 *
 * SIZING. Half-width showcase panel — roughly 390–560px, and narrower at lg
 * than at md because the section becomes two columns there. Density widens only
 * at xl and never reduces on the way up. Nothing renders below 9px.
 */

const METRICS = [
  { icon: Gauge, label: 'Win rate', value: '68.7%', delta: '+0.8%', up: true },
  { icon: Timer, label: 'Avg trade P&L', value: '+$124.75', delta: '-$8.20', up: false },
  { icon: Scale, label: 'Risk / reward', value: '2.5', delta: '+0.1', up: true },
];

/** Rising, with real pullbacks. A line that only goes up reads as a claim. */
const TREND = '0,52 20,47 40,41 60,43 80,34 100,36 120,26 140,29 160,18 180,12 200,14 220,5';

const STRENGTHS = [
  'Stops tightened on 14 of the last 20 trades — average loss fell from $312 to $188.',
  'Pre-market plan logged before 17 of 20 entries.',
];

const OPPORTUNITIES = [
  'Winners were closed at a median 1.4R while your average winner reached 2.1R.',
  'Three losses above 2R account for most of the drawdown in this range.',
];

export function AiCoachShowcase() {
  return (
    <div aria-hidden className="bg-background text-left">
      <div className="space-y-2 p-2.5">
        {/* ---- Performance cards ---- */}
        <div className="grid grid-cols-3 gap-1.5">
          {METRICS.map((m, i) => (
            <div
              key={m.label}
              className={cn(
                'rounded-md border border-border/70 bg-card p-1.5',
                // The third card waits for room; two carry the story on the
                // narrowest panel and stay readable doing it.
                i === 2 && 'hidden sm:block',
              )}
            >
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <m.icon className="size-2.5 shrink-0 text-primary" />
                <span className="truncate">{m.label}</span>
              </span>
              <span className="mt-0.5 block truncate font-display text-[13px] font-semibold tabular-nums">
                {m.value}
              </span>
              <span
                className={cn(
                  'mt-0.5 block text-[9px] font-medium tabular-nums',
                  m.up ? 'text-profit' : 'text-loss',
                )}
              >
                {m.delta}
              </span>
            </div>
          ))}
        </div>

        {/* ---- Review panel ---- */}
        <div className="rounded-md border border-border/70 bg-card">
          <div className="flex items-center gap-1.5 border-b border-border/70 px-2 py-1.5">
            <span className="flex size-4 items-center justify-center rounded bg-primary/10 text-primary">
              <Sparkles className="size-2.5" />
            </span>
            <span className="text-[10px] font-semibold">AI Coach review</span>
            <span className="ml-auto rounded border border-border/70 px-1.5 py-px text-[9px] text-muted-foreground">
              Last 20 trades
            </span>
          </div>

          <div className="space-y-2 p-2">
            {/* Summary + the evidence it is drawn from */}
            <div>
              <p className="text-[10px] leading-snug">
                <span className="font-semibold">Your average loss is shrinking</span>
                <span className="text-muted-foreground">
                  {' '}
                  while win rate held steady — the gain came from smaller losers, not more winners.
                </span>
              </p>
              {/*
               * The evidence line. In the real product an insight carries the
               * trades it was computed from; the illustration shows the same
               * relationship rather than a bare assertion.
               */}
              <p className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="rounded bg-muted px-1 py-px font-medium text-foreground">
                  Trade log
                </span>
                Apr 2 – Apr 23 · 20 trades
              </p>
            </div>

            {/* Trend chart */}
            <div className="rounded border border-border/70 bg-background px-1.5 pb-1 pt-1.5">
              <span className="block text-[9px] text-muted-foreground">Cumulative P&amp;L</span>
              <svg
                viewBox="0 0 220 56"
                preserveAspectRatio="none"
                className="mt-0.5 h-[42px] w-full sm:h-[52px]"
                role="presentation"
              >
                <defs>
                  <linearGradient id="mt-coach-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={`${TREND} 220,56 0,56`} fill="url(#mt-coach-trend)" />
                <polyline
                  points={TREND}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            {/* Observations. Two columns only where both stay readable. */}
            <div className="grid gap-2 xl:grid-cols-2">
              <div>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.06em] text-profit">
                  Working well
                </span>
                <ul className="mt-1 space-y-1">
                  {STRENGTHS.map((s, i) => (
                    <li
                      key={s}
                      className={cn(
                        'flex gap-1 text-[9px] leading-snug text-muted-foreground',
                        // The second point waits for room rather than wrapping
                        // into an unreadable block.
                        i === 1 && 'hidden sm:flex',
                      )}
                    >
                      <Check className="mt-px size-2.5 shrink-0 text-profit" strokeWidth={3} />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.06em] text-foreground">
                  Worth reviewing
                </span>
                <ul className="mt-1 space-y-1">
                  {OPPORTUNITIES.map((o, i) => (
                    <li
                      key={o}
                      className={cn(
                        'flex gap-1 text-[9px] leading-snug text-muted-foreground',
                        i === 1 && 'hidden xl:flex',
                      )}
                    >
                      <span className="mt-[3px] size-1 shrink-0 rounded-full bg-warning" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The honesty caption, matching the other previews. */}
      <div className="flex items-center gap-1.5 border-t border-border/70 bg-muted/40 px-2.5 py-1">
        <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Sample data
        </span>
        <span className="truncate text-[9px] text-muted-foreground">
          Illustration — not real trading performance.
        </span>
      </div>
    </div>
  );
}

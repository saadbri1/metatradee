import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Copy,
  Eye,
  FileDown,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Marketing preview of the MetaTradee Reports screen.
 *
 * BUILT, NOT SCREENSHOT. HTML, SVG and design tokens — sharp on Retina, follows
 * the theme, reflows, stays editable.
 *
 * NOT THE REAL REPORTS PAGE. No shared component, query or route with the
 * authenticated app. It generates nothing, exports nothing, and the "shareable
 * link" is a dead string — the real one is revocable and scoped, and a
 * marketing illustration must not be able to mint one or appear to.
 *
 * WHAT THIS SECTION IS ACTUALLY SELLING is "share proof, not your account", so
 * the verification marks and the "only verified metrics are included" line are
 * the subject of the composition rather than decoration on it. That is why the
 * metric list keeps its check marks at every breakpoint while the export
 * buttons are allowed to drop.
 *
 * SIZING. Half-width showcase panel — roughly 390–560px, and narrower at lg
 * than at md because the section becomes two columns there. Density widens only
 * at xl and never reduces on the way up. Nothing renders below 9px.
 */

const SUMMARY = [
  { icon: TrendingUp, label: 'Verified metrics', value: '24', delta: '+14%' },
  { icon: Users, label: 'Shared reports', value: '7', delta: '+40%' },
  { icon: Eye, label: 'Total views', value: '1.2K', delta: '+28%' },
];

const RANGES = ['7D', '30D', '90D', '1Y', 'All'];

interface Metric {
  label: string;
  value: string;
  /** How the figure should read: a gain, a loss, or a plain count. */
  tone: 'profit' | 'loss' | 'neutral';
}

const METRICS: Metric[] = [
  { label: 'Net P&L', value: '+24.37%', tone: 'profit' },
  { label: 'Win rate', value: '68.6%', tone: 'neutral' },
  { label: 'Profit factor', value: '2.14', tone: 'neutral' },
  /*
   * Drawdown reads as a LOSS, not a gain. The reference tinted it green
   * because the number happens to be small, but a negative figure in the
   * profit colour is exactly the kind of flattering ambiguity this product
   * refuses elsewhere.
   */
  { label: 'Max drawdown', value: '-6.21%', tone: 'loss' },
  { label: 'Total trades', value: '312', tone: 'neutral' },
];

/** Percent-return curve: rises across the month with genuine pullbacks. */
const CURVE =
  '0,132 14,130 28,120 42,108 56,101 70,104 84,109 98,106 112,92 126,80 140,82 154,86 168,78 182,64 196,58 210,61 224,55 238,44 252,47 266,40 280,33 294,36 308,26 322,18 336,14 350,10';

const Y_LABELS = ['30%', '20%', '10%', '0%', '-10%'];
const X_LABELS = ['May 1', 'May 11', 'May 21', 'May 31'];

export function ReportsShowcase() {
  return (
    <div aria-hidden className="bg-background text-left">
      <div className="space-y-2 p-2.5">
        {/* ---- Summary cards ---- */}
        <div className="grid grid-cols-3 gap-1.5">
          {SUMMARY.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'rounded-md border border-border/70 bg-card p-1.5',
                // Views is the least load-bearing of the three on a narrow panel.
                i === 2 && 'hidden sm:block',
              )}
            >
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <s.icon className="size-2.5 shrink-0 text-primary" />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-[13px] font-semibold tabular-nums">
                  {s.value}
                </span>
                <span className="rounded bg-profit/10 px-1 text-[9px] font-medium tabular-nums text-profit">
                  {s.delta}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* ---- Performance summary ---- */}
        <div className="rounded-md border border-border/70 bg-card">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/70 px-2 py-1.5">
            <span className="text-[10px] font-semibold">Performance summary</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="hidden items-center gap-1 rounded border border-border/70 px-1.5 py-px text-[9px] text-muted-foreground sm:inline-flex">
                <CalendarDays className="size-2.5" /> May 1 – May 31, 2026
                <ChevronDown className="size-2.5" />
              </span>
              {/* Range control. Segmented, with the active step carried by
                  weight and fill rather than colour alone. */}
              <span className="inline-flex overflow-hidden rounded border border-border/70">
                {RANGES.map((r, i) => (
                  <span
                    key={r}
                    className={cn(
                      'px-1.5 py-px text-[9px] tabular-nums',
                      i > 0 && 'border-l border-border/70',
                      r === '30D'
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'font-medium text-muted-foreground',
                      // Middle ranges drop first; the active one never does.
                      i > 2 && 'hidden xl:inline-block',
                    )}
                  >
                    {r}
                  </span>
                ))}
              </span>
            </span>
          </div>

          <div className="grid gap-2 p-2 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            {/* Verified metric list — the subject of this section. */}
            <ul className="space-y-px">
              {METRICS.map((m, i) => (
                <li
                  key={m.label}
                  className={cn(
                    'flex items-center gap-1.5 py-1 text-[9px]',
                    i < METRICS.length - 1 && 'border-b border-border/50',
                  )}
                >
                  <BadgeCheck className="size-3 shrink-0 text-profit" />
                  <span className="truncate text-muted-foreground">{m.label}</span>
                  <span
                    className={cn(
                      'ml-auto shrink-0 font-semibold tabular-nums',
                      m.tone === 'profit' && 'text-profit',
                      m.tone === 'loss' && 'text-loss',
                      m.tone === 'neutral' && 'text-foreground',
                    )}
                  >
                    {m.value}
                  </span>
                </li>
              ))}
            </ul>

            {/* Chart */}
            <div className="flex min-w-0 gap-1">
              <div className="flex w-6 shrink-0 flex-col justify-between py-px text-right text-[9px] text-muted-foreground">
                {Y_LABELS.map((y) => (
                  <span key={y}>{y}</span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <svg
                  viewBox="0 0 350 148"
                  preserveAspectRatio="none"
                  className="h-[86px] w-full sm:h-[104px]"
                  role="presentation"
                >
                  <defs>
                    <linearGradient id="mt-reports-curve" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--profit))" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="hsl(var(--profit))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0, 37, 74, 111, 147].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="350"
                      y2={y}
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  <polygon points={`${CURVE} 350,148 0,148`} fill="url(#mt-reports-curve)" />
                  <polyline
                    points={CURVE}
                    fill="none"
                    stroke="hsl(var(--profit))"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                  {X_LABELS.map((x) => (
                    <span key={x} className="whitespace-nowrap">
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ---- Sharing footer ---- */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 bg-muted/30 px-2 py-1.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-profit/10 text-profit">
              <ShieldCheck className="size-3" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[9px] font-semibold">Share this report</span>
              <span className="block truncate text-[9px] text-muted-foreground">
                Only verified metrics are included.
              </span>
            </span>

            <span className="ml-auto flex min-w-0 items-center gap-1">
              {/* The link and Copy read as one control, as they do in the app. */}
              <span className="hidden min-w-0 items-center overflow-hidden rounded border border-border/70 bg-card sm:flex">
                <span className="truncate px-1.5 py-1 text-[9px] text-primary">
                  metatradee.app/report/7xK9aL2b
                </span>
                <span className="flex shrink-0 items-center gap-1 border-l border-border/70 bg-profit px-1.5 py-1 text-[9px] font-semibold text-background">
                  <Copy className="size-2.5" /> Copy
                </span>
              </span>
              <span className="hidden shrink-0 items-center gap-1 rounded border border-border/70 bg-card px-1.5 py-1 text-[9px] font-medium xl:inline-flex">
                <FileDown className="size-2.5" /> PDF
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary px-1.5 py-1 text-[9px] font-semibold text-primary-foreground">
                <FileDown className="size-2.5" /> CSV
              </span>
            </span>
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

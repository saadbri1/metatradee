import { ChevronDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Marketing preview of the MetaTradee Analytics screen.
 *
 * BUILT, NOT SCREENSHOT. HTML, SVG and design tokens — sharp on Retina, follows
 * the theme, reflows, stays editable.
 *
 * NOT THE REAL ANALYTICS PAGE. It shares no component, query or route with the
 * authenticated app and computes nothing: every metric below is a written-down
 * string, not a derived value. That is deliberate — the whole point of the real
 * engine is that its numbers reconcile, and a marketing illustration must not
 * be able to reach it, let alone appear to.
 *
 * ON THE NUMBERS. Invented, so the frame carries the same visible "Sample data"
 * caption as the hero and Journal previews, and the composition is aria-hidden
 * so no decorative control is offered to assistive tech as if it were real.
 *
 * SIZING. This lives in a half-width showcase panel — roughly 390–560px, and
 * NARROWER at lg than at md because the section becomes two columns exactly
 * there. So density widens only at xl and never reduces on the way up. Six KPI
 * cards do not fit in one row at this width at a legible size, so they wrap:
 * two columns by default, three at xl. Nothing renders below 9px.
 */

const TABS = ['Overview', 'Performance', 'Risk', 'Setups & Symbols', 'Time', 'Behavior'];

interface Kpi {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  /** Which micro-visual sits beside the value. */
  visual: 'spark' | 'ring' | 'bar' | 'split';
  /** Best/Worst renders two signed values rather than one. */
  negative?: string;
}

const KPIS: Kpi[] = [
  { label: 'Net P&L', value: '$9,512.50', delta: '12.7%', up: true, visual: 'spark' },
  { label: 'Win rate', value: '68.6%', delta: '4.1%', up: true, visual: 'ring' },
  { label: 'Profit factor', value: '1.87', delta: '0.23', up: true, visual: 'spark' },
  { label: 'Expectancy', value: '$28.41', delta: '$4.03', up: true, visual: 'spark' },
  { label: 'Avg win / loss', value: '1.67', delta: '0.05', up: true, visual: 'bar' },
  {
    label: 'Best / worst',
    value: '$1,487.50',
    negative: '-$562.50',
    delta: '23.4%',
    up: true,
    visual: 'split',
  },
];

/** A short, uneven sparkline. Real ones are not smooth. */
const SPARK = '0,14 8,11 16,13 24,7 32,9 40,5 48,8 56,3 64,5 72,1';

/**
 * Equity curve. Rises with genuine pullbacks rather than as a clean arc — a
 * marketing chart that only goes up reads as a claim, not an illustration.
 */
const EQUITY =
  '0,158 12,156 24,152 36,153 48,147 60,144 72,146 84,140 96,137 108,138 120,133 132,131 144,132 156,127 168,124 180,125 192,120 204,116 216,118 228,112 240,101 252,99 264,100 276,96 288,94 300,95 312,89 324,86 336,88 348,80 360,72 372,74 384,66 396,60 408,62 420,52 432,44 444,46 456,38 468,30 480,33 492,24 504,18 516,22 528,14';

const X_LABELS = ['Apr 1', 'Apr 15', 'May 1', 'May 15', 'Jun 1', 'Jun 15', 'Jul 1'];
const Y_LABELS = ['$12K', '$9K', '$6K', '$3K', '$0'];

function Sparkline() {
  return (
    <svg viewBox="0 0 72 16" className="h-3.5 w-10 shrink-0" role="presentation">
      <polyline
        points={SPARK}
        fill="none"
        stroke="hsl(var(--profit))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function WinRateRing() {
  // 68.6% of a 2πr circumference (r=7 → ~43.98).
  const c = 43.98;
  return (
    <svg viewBox="0 0 18 18" className="size-4 shrink-0 -rotate-90" role="presentation">
      <circle cx="9" cy="9" r="7" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        stroke="hsl(var(--profit))"
        strokeWidth="3"
        strokeDasharray={`${c * 0.686} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function WinLossBar() {
  return (
    <span className="flex h-1.5 w-9 shrink-0 overflow-hidden rounded-full">
      <span className="h-full flex-[63] bg-profit" />
      <span className="h-full flex-[8] bg-muted" />
      <span className="h-full flex-[29] bg-loss" />
    </span>
  );
}

function KpiVisual({ visual }: { visual: Kpi['visual'] }) {
  if (visual === 'ring') return <WinRateRing />;
  if (visual === 'bar') return <WinLossBar />;
  if (visual === 'split') return null;
  return <Sparkline />;
}

export function AnalyticsShowcase() {
  return (
    <div aria-hidden className="text-left">
      <div className="flex">
        {/* ---- Icon rail. Dark navy in both themes, matching the real one. ---- */}
        <div className="flex w-9 shrink-0 flex-col items-center gap-1.5 bg-sidebar py-2.5 sm:w-11">
          <span className="flex items-end gap-[2px] pb-1">
            <span className="h-1.5 w-2.5 translate-x-px rounded-[2px] bg-primary" />
            <span className="h-1.5 w-2.5 rounded-[2px] bg-sidebar-foreground" />
          </span>
          <span className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground sm:size-6">
            <Plus className="size-3" />
          </span>
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'relative flex size-5 items-center justify-center rounded-md sm:size-6',
                // Analytics is the third section in the rail.
                i === 2 && 'bg-sidebar-accent',
              )}
            >
              {i === 2 ? (
                <span className="absolute -left-2.5 h-3 w-[2px] rounded-r-full bg-primary" />
              ) : null}
              <span
                className={cn(
                  'size-2.5 rounded-[3px]',
                  i === 2 ? 'bg-sidebar-foreground' : 'bg-sidebar-muted-foreground/45',
                )}
              />
            </span>
          ))}
        </div>

        {/* ---- Analytics surface ---- */}
        <div className="min-w-0 flex-1 bg-background">
          {/* App header */}
          <div className="flex h-8 items-center gap-2 border-b border-border/70 px-2.5">
            <span className="text-[10px] font-semibold">Analytics</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="hidden items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5 text-[9px] text-muted-foreground sm:inline-flex">
                <Search className="size-2.5" /> Search
              </span>
              <span className="size-4 rounded-full bg-muted" />
            </span>
          </div>

          <div className="space-y-2 p-2.5">
            {/* Page title + filters */}
            <div className="flex items-center gap-2">
              <h4 className="font-display text-[13px] font-semibold tracking-tight">Analytics</h4>
              <span className="ml-auto flex items-center gap-1">
                {['All accounts', 'All time', 'Both sides'].map((f, i) => (
                  <span
                    key={f}
                    className={cn(
                      'items-center gap-0.5 rounded-md border border-border/70 bg-card px-1.5 py-1 text-[9px] font-medium',
                      // Filters drop one at a time as the panel narrows.
                      i === 0 && 'hidden xl:inline-flex',
                      i === 1 && 'hidden sm:inline-flex',
                      i === 2 && 'inline-flex',
                    )}
                  >
                    {f} <ChevronDown className="size-2.5" />
                  </span>
                ))}
              </span>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-3 border-b border-border/70">
              {TABS.map((tab, i) => (
                <span
                  key={tab}
                  className={cn(
                    'whitespace-nowrap pb-1 text-[9px]',
                    i === 0
                      ? '-mb-px border-b-2 border-foreground font-semibold text-foreground'
                      : 'font-medium text-muted-foreground',
                    // Secondary tabs appear as room allows.
                    i > 2 && 'hidden sm:inline',
                    i > 3 && 'sm:hidden xl:inline',
                  )}
                >
                  {tab}
                </span>
              ))}
            </div>

            {/* KPI cards — six of them wrap; one row is illegible at this width. */}
            <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-3">
              {KPIS.map((kpi, i) => (
                <div
                  key={kpi.label}
                  className={cn(
                    'rounded-md border border-border/70 bg-card p-1.5',
                    // Four cards is the readable floor on the narrowest panel.
                    i > 3 && 'hidden sm:block',
                  )}
                >
                  <span className="block truncate text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
                    {kpi.label}
                  </span>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="min-w-0 truncate font-display text-[12px] font-semibold tabular-nums">
                      {kpi.value}
                      {kpi.negative ? (
                        <>
                          <span className="text-muted-foreground"> / </span>
                          <span className="text-loss">{kpi.negative}</span>
                        </>
                      ) : null}
                    </span>
                    <span className="ml-auto shrink-0">
                      <KpiVisual visual={kpi.visual} />
                    </span>
                  </div>
                  <span
                    className={cn(
                      'mt-0.5 block truncate text-[9px] tabular-nums',
                      kpi.up ? 'text-profit' : 'text-loss',
                    )}
                  >
                    {kpi.up ? '↑' : '↓'} {kpi.delta}{' '}
                    <span className="text-muted-foreground">vs last period</span>
                  </span>
                </div>
              ))}
            </div>

            {/* Equity curve */}
            <div className="rounded-md border border-border/70 bg-card">
              <div className="border-b border-border/70 px-2 py-1.5">
                <span className="text-[10px] font-semibold">Equity curve</span>
              </div>
              <div className="flex gap-1 p-2">
                {/* Y axis */}
                <div className="flex w-7 shrink-0 flex-col justify-between py-px text-right text-[9px] text-muted-foreground">
                  {Y_LABELS.map((y) => (
                    <span key={y}>{y}</span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <svg
                    viewBox="0 0 528 172"
                    preserveAspectRatio="none"
                    className="h-[96px] w-full sm:h-[112px]"
                    role="presentation"
                  >
                    <defs>
                      <linearGradient id="mt-analytics-eq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--profit))" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="hsl(var(--profit))" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Horizontal grid, one line per Y label. */}
                    {[0, 43, 86, 129, 171].map((y) => (
                      <line
                        key={y}
                        x1="0"
                        y1={y}
                        x2="528"
                        y2={y}
                        stroke="hsl(var(--border))"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {/* Vertical grid, one per date label. */}
                    {[0, 88, 176, 264, 352, 440, 527].map((x) => (
                      <line
                        key={x}
                        x1={x}
                        y1="0"
                        x2={x}
                        y2="172"
                        stroke="hsl(var(--border))"
                        strokeWidth="1"
                        strokeOpacity="0.6"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    <polygon points={`${EQUITY} 528,172 0,172`} fill="url(#mt-analytics-eq)" />
                    <polyline
                      points={EQUITY}
                      fill="none"
                      stroke="hsl(var(--profit))"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {/* X axis */}
                  <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                    {X_LABELS.map((x, i) => (
                      <span
                        key={x}
                        className={cn('whitespace-nowrap', i % 2 === 1 && 'hidden sm:inline')}
                      >
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The honesty caption, matching the hero and Journal previews. */}
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

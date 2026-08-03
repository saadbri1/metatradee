import type { CSSProperties } from 'react';
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  Filter,
  LayoutDashboard,
  LineChart,
  NotebookPen,
  RefreshCw,
  Share2,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Marketing showcase of the MetaTradee workspace.
 *
 * BUILT, NOT SCREENSHOT. Every surface here is HTML and tokens, so it stays
 * crisp on Retina, reflows responsively, and can be edited later — a flat image
 * would do none of those.
 *
 * IT IS NOT THE REAL DASHBOARD. It shares no component, query or route with the
 * authenticated app: it is a static illustration living entirely in the
 * marketing feature, and it reads no user data.
 *
 * ON THE NUMBERS. The figures below are invented, and the project's standard is
 * that invented figures are never presented as real. They are therefore labelled
 * "Sample data" in the frame itself — visible to a reader, not buried in a
 * comment — and the whole composition is aria-hidden so a screen reader is never
 * read a performance claim that did not happen. The previous placeholder solved
 * this by having no numbers at all; a richer showcase needs the label instead.
 *
 * Progressive disclosure by breakpoint rather than one shrinking image:
 *   mobile  — sidebar edge + KPI strip + the main chart, still legible
 *   tablet  — adds the score card; floating cards drop away
 *   desktop — the full composition
 */

const NAV: { icon: typeof LayoutDashboard; label: string; active?: boolean }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: NotebookPen, label: 'Journal' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: LineChart, label: 'Chart' },
  { icon: CalendarDays, label: 'Calendar' },
  { icon: Target, label: 'Goals' },
  { icon: Bot, label: 'AI Coach' },
];

const KPIS = [
  { label: 'Net P&L', value: '$107,183.75', delta: '+12.7%', tone: 'profit' as const },
  { label: 'Trade expectancy', value: '$457.62', delta: '+8.3%', tone: 'profit' as const },
  { label: 'Profit factor', value: '1.87', delta: '+0.23', tone: 'profit' as const },
  { label: 'Win rate', value: '68.6%', delta: '+4.1%', tone: 'profit' as const },
  { label: 'Avg win/loss', value: '1.67', delta: '-0.05', tone: 'loss' as const },
];

/** Equity curve. Hand-placed so it rises like a real one — uneven, not a swoosh. */
const EQUITY =
  '0,128 26,120 52,124 78,101 104,108 130,86 156,92 182,70 208,76 234,52 260,58 286,44 312,49 338,30 364,35 390,18 416,22 442,10';

/** Four weeks of demo days. `null` = no trading day. */
const CALENDAR: ({ pnl: number; trades: number } | null)[] = [
  null,
  { pnl: 1150, trades: 2 },
  { pnl: 3080, trades: 2 },
  { pnl: 1050, trades: 1 },
  { pnl: 5350, trades: 1 },
  { pnl: -350, trades: 2 },
  null,
  null,
  { pnl: 600, trades: 1 },
  { pnl: 1090, trades: 2 },
  { pnl: -350, trades: 2 },
  { pnl: -638, trades: 2 },
  { pnl: 556, trades: 3 },
  null,
  null,
  { pnl: -788, trades: 3 },
  { pnl: 875, trades: 2 },
  { pnl: 608, trades: 1 },
  { pnl: 1180, trades: 3 },
  null,
  null,
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground lg:inline-flex">
      {children}
    </span>
  );
}

export function DashboardShowcase({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card text-left shadow-2xl shadow-primary/10',
        className,
      )}
    >
      <div className="flex">
        {/* ---- Sidebar. Dark navy in BOTH themes, exactly as the real rail. ---- */}
        <aside className="flex w-12 shrink-0 flex-col gap-3 bg-sidebar py-3 sm:w-[132px] sm:px-3 lg:w-[150px]">
          <div className="flex items-center gap-2 px-2 sm:px-0">
            <span className="flex shrink-0 items-end gap-[3px]">
              <span className="h-1.5 w-3 translate-x-px rounded-[2px] bg-primary" />
              <span className="h-1.5 w-3 rounded-[2px] bg-sidebar-foreground" />
            </span>
            <span className="hidden truncate font-display text-[11px] font-semibold text-sidebar-foreground sm:block">
              MetaTradee
            </span>
          </div>

          <div className="mx-2 hidden items-center justify-center gap-1 rounded-md bg-primary py-1.5 text-[10px] font-semibold text-primary-foreground sm:mx-0 sm:flex">
            + Add account
          </div>

          <nav className="flex flex-col gap-0.5 px-1.5 sm:px-0">
            {NAV.map((item) => (
              <span
                key={item.label}
                className={cn(
                  'relative flex items-center gap-2 rounded-md px-2 py-[7px] text-[10px] font-medium',
                  item.active
                    ? 'bg-sidebar-accent font-semibold text-sidebar-foreground'
                    : 'text-sidebar-muted-foreground',
                )}
              >
                {item.active ? (
                  <span className="absolute left-0 h-3.5 w-[2px] rounded-r-full bg-primary" />
                ) : null}
                <item.icon className="size-3.5 shrink-0" />
                <span className="hidden truncate sm:block">{item.label}</span>
              </span>
            ))}
          </nav>
        </aside>

        {/* ---- Workspace ---- */}
        <div className="min-w-0 flex-1 bg-background">
          {/* Top bar */}
          <div className="flex h-10 items-center gap-2 border-b border-border/70 px-3">
            <span className="font-display text-[11px] font-semibold">Dashboard</span>
            <div className="ml-auto flex items-center gap-1.5">
              <Pill>
                <RefreshCw className="size-2.5" />
              </Pill>
              <Pill>
                <Filter className="size-2.5" /> Filters <ChevronDown className="size-2.5" />
              </Pill>
              <Pill>
                <CalendarDays className="size-2.5" /> All time
              </Pill>
              <span className="inline-flex size-5 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
                <Bell className="size-2.5" />
              </span>
            </div>
          </div>

          <div className="space-y-2 p-2.5">
            {/* Greeting row — context, never the loudest thing on the page. */}
            <div className="flex items-center gap-2">
              <p className="truncate text-[10px] text-muted-foreground">
                Good morning, <span className="font-medium text-foreground">Sam</span>
              </p>
              <span className="ml-auto hidden items-center gap-1 rounded-md bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground sm:inline-flex">
                Import trades
              </span>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
              {KPIS.map((kpi, i) => (
                <div
                  key={kpi.label}
                  className={cn(
                    'preview-progressive rounded-md border border-border/70 bg-card p-2',
                    // Two KPIs is a readable minimum on mobile; five is a smear.
                    i > 1 && 'hidden sm:block',
                    i > 2 && 'sm:hidden lg:block',
                  )}
                  style={{ '--preview-delay': `${420 + i * 55}ms` } as CSSProperties}
                >
                  <span className="block truncate text-[8px] uppercase tracking-[0.08em] text-muted-foreground">
                    {kpi.label}
                  </span>
                  <span className="mt-1 block truncate font-display text-[13px] font-semibold tabular-nums">
                    {kpi.value}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block text-[8px] font-medium tabular-nums',
                      kpi.tone === 'profit' ? 'text-profit' : 'text-loss',
                    )}
                  >
                    {kpi.delta} vs last month
                  </span>
                </div>
              ))}
            </div>

            {/* Score + equity curve */}
            <div className="grid gap-1.5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
              {/* Score card — hidden on mobile so the chart keeps its width. */}
              <div className="hidden rounded-md border border-border/70 bg-card p-2 sm:block">
                <span className="block text-[9px] font-semibold">MetaTradee Score</span>
                <div className="mt-1 flex items-center gap-2.5">
                  <svg viewBox="0 0 84 84" className="size-[62px] shrink-0" role="presentation">
                    <polygon
                      points="42,6 78,42 42,78 6,42"
                      fill="hsl(var(--primary) / 0.08)"
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                    />
                    <polygon
                      points="42,20 64,42 42,66 22,42"
                      fill="hsl(var(--primary) / 0.16)"
                      stroke="hsl(var(--primary))"
                      strokeWidth="1.5"
                    />
                    <text
                      x="42"
                      y="47"
                      textAnchor="middle"
                      className="fill-foreground font-display text-[17px] font-semibold"
                    >
                      83
                    </text>
                  </svg>
                  <div className="min-w-0 space-y-1">
                    {['Win rate', 'Profit factor', 'Consistency'].map((label, i) => (
                      <div key={label}>
                        <span className="block text-[8px] text-muted-foreground">{label}</span>
                        <span className="mt-0.5 block h-1 w-full rounded-full bg-muted">
                          <span
                            className="block h-1 rounded-full bg-primary"
                            style={{ width: `${[82, 74, 68][i]}%` }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cumulative P&L — the one element that survives every breakpoint. */}
              <div className="rounded-md border border-border/70 bg-card p-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-semibold">Daily net cumulative P&amp;L</span>
                  <span className="ml-auto rounded bg-primary px-1.5 py-0.5 text-[8px] font-semibold tabular-nums text-primary-foreground">
                    $107,183.75
                  </span>
                </div>
                <svg
                  viewBox="0 0 442 140"
                  preserveAspectRatio="none"
                  className="mt-1.5 h-[74px] w-full sm:h-[92px]"
                  role="presentation"
                >
                  <defs>
                    <linearGradient id="mt-showcase-eq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[35, 70, 105].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="442"
                      y2={y}
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                    />
                  ))}
                  <polygon points={`${EQUITY} 442,140 0,140`} fill="url(#mt-showcase-eq)" />
                  <polyline
                    points={EQUITY}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            </div>

            {/* Calendar — desktop only. It is the densest element and the first
                thing that becomes unreadable when the frame narrows. */}
            <div className="hidden rounded-md border border-border/70 bg-card p-2 lg:block">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-semibold">August 2026</span>
                <span className="ml-auto text-[8px] text-muted-foreground">
                  Green = profitable day
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span
                    key={d}
                    className="text-center text-[7px] uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {d}
                  </span>
                ))}
                {CALENDAR.map((day, i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex h-8 flex-col items-center justify-center rounded-[3px] border text-[8px] tabular-nums',
                      !day && 'border-border/50 bg-muted/30',
                      day && day.pnl > 0 && 'border-profit/25 bg-profit/10 text-profit',
                      day && day.pnl < 0 && 'border-loss/25 bg-loss/10 text-loss',
                    )}
                  >
                    {day ? (
                      <>
                        <span className="font-semibold">
                          {day.pnl > 0 ? '+' : '−'}${Math.abs(day.pnl).toLocaleString('en-US')}
                        </span>
                        <span className="text-[7px] opacity-70">
                          {day.trades} trade{day.trades === 1 ? '' : 's'}
                        </span>
                      </>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/*
       * The honesty label. These figures are invented, so the frame says so
       * where a reader will actually see it — the standard is that placeholder
       * content is visibly labelled, not disclosed in a comment.
       */}
      <div className="flex items-center gap-2 border-t border-border/70 bg-muted/40 px-3 py-1.5">
        <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Sample data
        </span>
        <span className="truncate text-[9px] text-muted-foreground">
          Illustration of the MetaTradee workspace — not real trading performance.
        </span>
      </div>
    </div>
  );
}

/** Floating activity feed. Desktop only — it overlaps the frame by design. */
export function ShowcaseActivityCard({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const items = [
    { icon: RefreshCw, tag: 'Auto-sync', text: '7 trades pulled from your broker', when: '2s ago' },
    { icon: Share2, tag: 'Shared', text: 'Jay shared the “Breakout” playbook', when: '2:54 PM' },
  ];
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        'w-[236px] space-y-2 rounded-xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.tag} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <item.icon className="size-3" />
          </span>
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {item.tag}
              <span className="size-1 rounded-full bg-profit" />
              <span className="font-normal tracking-normal">{item.when}</span>
            </span>
            <p className="mt-0.5 text-[10px] leading-snug text-foreground">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Floating AI insight. Desktop only. */
export function ShowcaseInsightCard({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        'w-[224px] rounded-xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <Bot className="size-3 text-primary" /> AI Coach
      </span>
      <p className="mt-1.5 rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-[9px] text-muted-foreground">
        What if I only traded my top 2 setups?
      </p>
      <p className="mt-2 font-display text-[15px] font-semibold tabular-nums text-profit">
        +$2,140
      </p>
      <p className="mt-1 text-[9px] leading-snug text-muted-foreground">
        Your morning breakouts account for most of the gain. Two setups, same hours.
      </p>
    </div>
  );
}

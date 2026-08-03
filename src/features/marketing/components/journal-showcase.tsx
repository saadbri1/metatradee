import { Check, Columns3, Download, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Marketing preview of the MetaTradee Journal — the Trade Log screen.
 *
 * BUILT, NOT SCREENSHOT. HTML and design tokens, so it stays sharp on Retina,
 * reflows, follows the theme, and stays editable.
 *
 * NOT THE REAL JOURNAL. It shares no component, query or route with the
 * authenticated app, reads no user data, and computes nothing — the R multiples
 * and P&L below are written down, not derived.
 *
 * ON THE NUMBERS. They are invented, and this repo's standard is that invented
 * figures are never presented as real, so the frame carries a visible "Sample
 * data" caption and the whole composition is aria-hidden. The KPI values match
 * the hero showcase deliberately: two illustrations of the same fictional
 * account should not disagree with each other.
 *
 * SIZING. Unlike the hero, this sits in a half-width showcase panel — roughly
 * 350–580px at every breakpoint, and NARROWER at lg than at md, because the
 * section switches to two columns there. The column set is therefore
 * conservative by default and only widens at xl, rather than tracking viewport
 * width in a way that would drop columns as the screen gets bigger.
 */

const KPIS = [
  { label: 'Net P&L', value: '$107,183.75', delta: '+12.7%', up: true },
  { label: 'Profit factor', value: '1.87', delta: '+0.23', up: true },
  { label: 'Win rate', value: '68.6%', delta: '+4.1%', up: true },
  { label: 'Avg win/loss', value: '1.67', delta: '-0.05', up: false },
];

interface Row {
  date: string;
  symbol: string;
  side: 'Long' | 'Short';
  setup: string;
  pnl: number;
  r: string;
  reviewed: boolean;
}

const ROWS: Row[] = [
  {
    date: 'Jun 6',
    symbol: 'ESM2',
    side: 'Long',
    setup: 'Breakout',
    pnl: 1212.5,
    r: '2.42R',
    reviewed: true,
  },
  {
    date: 'Jun 6',
    symbol: 'NQM2',
    side: 'Short',
    setup: 'Reversal',
    pnl: -562.5,
    r: '-1.12R',
    reviewed: true,
  },
  {
    date: 'Jun 6',
    symbol: 'ESM2',
    side: 'Long',
    setup: 'Breakout',
    pnl: 837.5,
    r: '1.68R',
    reviewed: true,
  },
  {
    date: 'Jun 6',
    symbol: 'YMM2',
    side: 'Long',
    setup: 'Trend',
    pnl: 1050,
    r: '2.10R',
    reviewed: true,
  },
  {
    date: 'Jun 6',
    symbol: 'NQM2',
    side: 'Short',
    setup: 'Breakdown',
    pnl: -325,
    r: '-0.65R',
    reviewed: false,
  },
  {
    date: 'Jun 6',
    symbol: 'ESM2',
    side: 'Long',
    setup: 'Breakout',
    pnl: 1487.5,
    r: '2.97R',
    reviewed: true,
  },
];

const NAV_ICONS = 8;
/** Journal is index 2 in the rail — the active section. */
const ACTIVE_NAV = 2;

function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function JournalShowcase() {
  return (
    <div aria-hidden className="text-left">
      <div className="flex">
        {/* ---- Compact icon rail. Dark navy in both themes, like the real one. ---- */}
        <div className="flex w-9 shrink-0 flex-col items-center gap-1.5 bg-sidebar py-2.5 sm:w-11">
          <span className="flex items-end gap-[2px] pb-1">
            <span className="h-1.5 w-2.5 translate-x-px rounded-[2px] bg-primary" />
            <span className="h-1.5 w-2.5 rounded-[2px] bg-sidebar-foreground" />
          </span>
          <span className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground sm:size-6">
            <Plus className="size-3" />
          </span>
          {Array.from({ length: NAV_ICONS }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'relative flex size-5 items-center justify-center rounded-md sm:size-6',
                i === ACTIVE_NAV ? 'bg-sidebar-accent' : '',
              )}
            >
              {i === ACTIVE_NAV ? (
                <span className="absolute -left-2.5 h-3 w-[2px] rounded-r-full bg-primary" />
              ) : null}
              <span
                className={cn(
                  'size-2.5 rounded-[3px]',
                  i === ACTIVE_NAV ? 'bg-sidebar-foreground' : 'bg-sidebar-muted-foreground/45',
                )}
              />
            </span>
          ))}
        </div>

        {/* ---- Journal surface ---- */}
        <div className="min-w-0 flex-1 bg-background">
          {/* App top bar */}
          <div className="flex h-8 items-center gap-2 border-b border-border/70 px-2.5">
            <span className="text-[10px] font-semibold">Journal</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="hidden items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5 text-[9px] text-muted-foreground sm:inline-flex">
                <Search className="size-2.5" /> Search
              </span>
              <span className="size-4 rounded-full bg-muted" />
            </span>
          </div>

          <div className="space-y-2 p-2.5">
            {/* Page heading + primary actions */}
            <div className="flex items-center gap-2">
              <h4 className="font-display text-[13px] font-semibold tracking-tight">Trade Log</h4>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="hidden items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-1 text-[9px] font-medium sm:inline-flex">
                  <Download className="size-2.5" /> Import trades
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground">
                  <Plus className="size-2.5" /> New trade
                </span>
              </span>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
              {KPIS.map((kpi) => (
                <div key={kpi.label} className="rounded-md border border-border/70 bg-card p-1.5">
                  <span className="block truncate text-[9px] text-muted-foreground">
                    {kpi.label}
                  </span>
                  <span className="mt-0.5 block truncate font-display text-[13px] font-semibold tabular-nums">
                    {kpi.value}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block text-[9px] font-medium tabular-nums',
                      kpi.up ? 'text-profit' : 'text-loss',
                    )}
                  >
                    {kpi.up ? '↑' : '↓'} {kpi.delta}
                  </span>
                </div>
              ))}
            </div>

            {/* Search + filter controls */}
            <div className="flex items-center gap-1.5">
              <span className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-1 text-[9px] text-muted-foreground">
                <Search className="size-2.5 shrink-0" />
                <span className="truncate">Search symbol…</span>
              </span>
              <span className="hidden items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-1 text-[9px] font-medium sm:inline-flex">
                <Columns3 className="size-2.5" /> Columns
              </span>
              <span className="hidden items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-1 text-[9px] font-medium xl:inline-flex">
                Reviewed
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-1 text-[9px] font-medium">
                <SlidersHorizontal className="size-2.5" /> Newest
              </span>
            </div>

            {/* Trade log table */}
            <div className="overflow-hidden rounded-md border border-border/70 bg-card">
              <div className="border-b border-border/70 px-2 py-1">
                <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Trade log
                </span>
              </div>
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="border-b border-border/70 text-[9px] text-muted-foreground">
                    <th className="w-[17%] px-2 py-1 text-left font-medium">Date</th>
                    <th className="w-[19%] px-1 py-1 text-left font-medium">Symbol</th>
                    <th className="w-[19%] px-1 py-1 text-left font-medium">Side</th>
                    {/* Secondary columns appear only where the panel is wide enough. */}
                    <th className="hidden w-[18%] px-1 py-1 text-left font-medium xl:table-cell">
                      Setup
                    </th>
                    <th className="w-[25%] px-1 py-1 text-right font-medium">Net P&amp;L</th>
                    <th className="hidden w-[13%] px-1 py-1 text-right font-medium xl:table-cell">
                      R
                    </th>
                    <th className="w-[12%] px-2 py-1 text-center font-medium xl:w-[10%]">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, i) => (
                    <tr
                      key={i}
                      className={cn(
                        'text-[9px] tabular-nums',
                        i < ROWS.length - 1 && 'border-b border-border/50',
                        // Six rows is a lot of vertical space in a half-width
                        // panel; the last two wait for room.
                        i > 3 && 'hidden xl:table-row',
                      )}
                    >
                      <td className="truncate px-2 py-[5px] text-muted-foreground">{row.date}</td>
                      <td className="truncate px-1 py-[5px] font-medium">{row.symbol}</td>
                      <td className="px-1 py-[5px]">
                        <span
                          className={cn(
                            'inline-block rounded px-1 py-px text-[8px] font-medium',
                            row.side === 'Long'
                              ? 'bg-profit/10 text-profit'
                              : 'bg-loss/10 text-loss',
                          )}
                        >
                          {row.side}
                        </span>
                      </td>
                      <td className="hidden truncate px-1 py-[5px] text-muted-foreground xl:table-cell">
                        {row.setup}
                      </td>
                      <td
                        className={cn(
                          'truncate px-1 py-[5px] text-right font-medium',
                          row.pnl >= 0 ? 'text-profit' : 'text-loss',
                        )}
                      >
                        {money(row.pnl)}
                      </td>
                      <td className="hidden px-1 py-[5px] text-right text-muted-foreground xl:table-cell">
                        {row.r}
                      </td>
                      <td className="px-2 py-[5px]">
                        <span className="mx-auto flex size-3 items-center justify-center rounded-full border">
                          {row.reviewed ? (
                            <Check className="size-2 text-profit" strokeWidth={3} />
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center gap-2 border-t border-border/70 px-2 py-1">
                <span className="truncate text-[9px] text-muted-foreground">
                  <span className="hidden sm:inline">Showing 1 to 6 of </span>248 results
                </span>
                <span className="ml-auto flex items-center gap-0.5">
                  {['1', '2', '3'].map((p, i) => (
                    <span
                      key={p}
                      className={cn(
                        'flex size-3.5 items-center justify-center rounded text-[8px] font-medium',
                        i === 0
                          ? 'border border-primary text-primary'
                          : 'text-muted-foreground xl:inline-flex',
                        i > 0 && 'hidden xl:flex',
                      )}
                    >
                      {p}
                    </span>
                  ))}
                  <span className="hidden text-[8px] text-muted-foreground xl:inline">… 42</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/*
       * The honesty caption, matching the hero showcase. These figures are
       * invented, so the frame says so where a reader sees it.
       */}
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

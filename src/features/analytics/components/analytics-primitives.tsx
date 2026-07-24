'use client';

import type { ReactNode } from 'react';
import { Info, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { money, percent, ratio, integer } from '../format';
import type { BreakdownRow, Kpis } from '../types';

/** A compact metric tile with a formula tooltip. Value is pre-formatted text. */
export function Stat({
  label,
  value,
  hint,
  context,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  context?: ReactNode;
  tone?: 'profit' | 'loss' | null;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card p-3 shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="truncate">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground/70 hover:text-foreground"
              aria-label={`About ${label}`}
            >
              <Info className="size-3" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <p
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums tracking-tight',
          tone === 'profit' && 'text-profit',
          tone === 'loss' && 'text-loss',
        )}
      >
        {value}
      </p>
      {context ? (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{context}</p>
      ) : null}
    </div>
  );
}

/** A metric that is deliberately unavailable, with a precise reason. */
export function LockedStat({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Lock className="size-3" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Unavailable</p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{reason}</p>
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-md border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]',
        className,
      )}
    >
      <header className="flex min-h-[46px] flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {action}
      </header>
      <div className="min-h-0 flex-1 p-3">{children}</div>
    </section>
  );
}

/** Horizontal Net-P&L bars for a ranked breakdown (dual-encoded with text). */
export function BreakdownBars({
  rows,
  max = 8,
  onSelect,
}: {
  rows: BreakdownRow[];
  max?: number;
  onSelect?: (row: BreakdownRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No data in this range.</p>;
  }
  const top = [...rows].sort((a, b) => b.kpis.netProfit - a.kpis.netProfit).slice(0, max);
  const maxAbs = Math.max(...top.map((r) => Math.abs(r.kpis.netProfit)), 1);
  return (
    <ul className="space-y-1.5">
      {top.map((row) => {
        const width = (Math.abs(row.kpis.netProfit) / maxAbs) * 100;
        const positive = row.kpis.netProfit >= 0;
        const content = (
          <>
            <span className="w-24 shrink-0 truncate text-xs" title={row.label}>
              {row.label}
            </span>
            <span className="relative flex h-4 flex-1 items-center">
              <span
                className={cn('absolute h-2 rounded-sm', positive ? 'bg-profit' : 'bg-loss')}
                style={{ width: `${width}%` }}
                aria-hidden
              />
            </span>
            <span
              className={cn(
                'w-24 shrink-0 text-right text-xs tabular-nums',
                positive ? 'text-profit' : 'text-loss',
              )}
            >
              {money(row.kpis.netProfit)}
            </span>
          </>
        );
        return (
          <li key={row.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(row)}
                className="flex w-full items-center gap-3 rounded px-1 py-0.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={`Filter by ${row.label}, net P&L ${money(row.kpis.netProfit)}`}
              >
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-1 py-0.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const SORTABLE = {
  netProfit: (k: Kpis) => k.netProfit,
  totalTrades: (k: Kpis) => k.totalTrades,
  winRate: (k: Kpis) => k.winRate ?? -1,
  profitFactor: (k: Kpis) => k.profitFactor ?? -1,
  expectancy: (k: Kpis) => k.expectancy ?? -Infinity,
} as const;

/** Dense KPI table for a breakdown dimension, sortable, with click-to-filter. */
export function BreakdownKpiTable({
  rows,
  dimensionLabel,
  sortKey = 'netProfit',
  onSort,
  onSelect,
}: {
  rows: BreakdownRow[];
  dimensionLabel: string;
  sortKey?: keyof typeof SORTABLE;
  onSort?: (key: keyof typeof SORTABLE) => void;
  onSelect?: (row: BreakdownRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No trades to break down in this range.
      </p>
    );
  }
  const sorted = [...rows].sort((a, b) => SORTABLE[sortKey](b.kpis) - SORTABLE[sortKey](a.kpis));
  const header = (key: keyof typeof SORTABLE, label: string) => (
    <th
      scope="col"
      aria-sort={sortKey === key ? 'descending' : 'none'}
      className="px-3 py-2 text-right"
    >
      {onSort ? (
        <button
          type="button"
          onClick={() => onSort(key)}
          className={cn('ml-auto hover:text-foreground', sortKey === key && 'text-foreground')}
        >
          {label}
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-md border border-border/70">
      <table className="w-full min-w-[720px] text-xs">
        <caption className="sr-only">Performance by {dimensionLabel}</caption>
        <thead className="bg-muted/50 text-[11px] text-muted-foreground">
          <tr className="border-b border-border/70">
            <th scope="col" className="px-3 py-2 text-left">
              {dimensionLabel}
            </th>
            {header('totalTrades', 'Trades')}
            {header('netProfit', 'Net P&L')}
            {header('winRate', 'Win %')}
            {header('profitFactor', 'PF')}
            {header('expectancy', 'Expectancy')}
            <th scope="col" className="px-3 py-2 text-right">
              Avg win
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Avg loss
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const cells = (
              <>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {integer(row.kpis.totalTrades)}
                </td>
                <td
                  className={cn(
                    'px-3 py-1.5 text-right font-medium tabular-nums',
                    row.kpis.netProfit > 0
                      ? 'text-profit'
                      : row.kpis.netProfit < 0
                        ? 'text-loss'
                        : '',
                  )}
                >
                  {money(row.kpis.netProfit)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{percent(row.kpis.winRate)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {ratio(row.kpis.profitFactor)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {money(row.kpis.expectancy)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-profit">
                  {money(row.kpis.avgWin)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-loss">
                  {money(row.kpis.avgLoss)}
                </td>
              </>
            );
            return (
              <tr
                key={row.key}
                className="border-b border-border/60 last:border-0 hover:bg-muted/30"
              >
                <td className="px-3 py-1.5">
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(row)}
                      className="max-w-[160px] truncate font-medium hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      title={`Filter by ${row.label}`}
                    >
                      {row.label}
                    </button>
                  ) : (
                    <span className="max-w-[160px] truncate font-medium">{row.label}</span>
                  )}
                </td>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { serializeTradeQuery } from '@/features/journal/filters';
import { Money } from '@/features/journal/components/pnl';
import { DOW_LABELS, MONTH_LABELS } from '../time';
import type { CalendarDay } from '../types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Journal drill-down URL for a given day (closed_at within the day, UTC bounds). */
function dayHref(dateKey: string): string {
  const qs = serializeTradeQuery(
    { date_from: `${dateKey}T00:00:00.000Z`, date_to: `${dateKey}T23:59:59.999Z` },
    'newest',
  );
  return `/journal${qs ? `?${qs}` : ''}`;
}

/**
 * Monthly calendar grid. Days are tz-correct (from the engine). Cells are links
 * (drill into that day's trades); arrow keys move focus across the grid, Enter
 * activates. Best/worst days highlighted; P&L dual-encoded (token color + text).
 */
export function MonthGrid({
  days,
  year,
  month,
}: {
  days: CalendarDay[];
  year: number;
  month: number; // 1-12
}) {
  const byDate = new Map(days.map((d) => [d.dateKey, d]));
  const monthDays = days.filter((d) => d.dateKey.startsWith(`${year}-${pad(month)}`));
  const nets = monthDays.map((d) => d.kpis.netProfit);
  const best = monthDays.find((d) => d.kpis.netProfit === Math.max(...nets, -Infinity))?.dateKey;
  const worst = monthDays.find((d) => d.kpis.netProfit === Math.min(...nets, Infinity))?.dateKey;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ];

  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    const delta =
      e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowLeft'
          ? -1
          : e.key === 'ArrowDown'
            ? 7
            : e.key === 'ArrowUp'
              ? -7
              : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = refs.current[idx + delta];
    next?.focus();
  }

  return (
    <div>
      <div
        role="grid"
        aria-label={`${MONTH_LABELS[month - 1]} ${year} performance calendar`}
        className="space-y-1"
      >
        <div
          role="row"
          className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground"
        >
          {DOW_LABELS.map((d) => (
            <span role="columnheader" key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div role="row" className="grid grid-cols-7 gap-1">
          {cells.map((dateKey, i) => {
            if (!dateKey) return <span key={`e${i}`} role="gridcell" aria-hidden />;
            const day = byDate.get(dateKey);
            const num = Number(dateKey.slice(-2));
            const cls = day?.classification;
            return (
              <Link
                key={dateKey}
                href={dayHref(dateKey)}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                role="gridcell"
                onKeyDown={(e) => onKeyDown(e, i)}
                aria-label={
                  day
                    ? `${dateKey}: ${day.kpis.totalTrades} trades, net ${day.kpis.netProfit}`
                    : `${dateKey}: no trades`
                }
                className={cn(
                  'flex min-h-16 flex-col rounded-md border p-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  !day && 'border-border text-muted-foreground',
                  cls === 'win' && 'border-profit/40 bg-profit/10',
                  cls === 'loss' && 'border-loss/40 bg-loss/10',
                  cls === 'break_even' && 'border-border',
                  dateKey === best && 'ring-1 ring-profit',
                  dateKey === worst && 'ring-1 ring-loss',
                )}
              >
                <span className="font-medium">{num}</span>
                {day ? (
                  <span className="mt-auto">
                    <Money value={day.kpis.netProfit} colored />
                    <span className="block text-[10px] text-muted-foreground">
                      {day.kpis.totalTrades}t
                    </span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

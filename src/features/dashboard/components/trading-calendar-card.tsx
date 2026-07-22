'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BookOpenText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DailyPnlPoint } from '../types';
import { cn } from '@/lib/utils';
import { DashboardInfoTip } from './dashboard-info-tip';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function TradingCalendarCard({
  points,
  onSelectDay,
}: {
  points: DailyPnlPoint[];
  onSelectDay: (day: string) => void;
}) {
  const initial = points.at(-1)?.dateKey
    ? new Date(`${points.at(-1)!.dateKey}T12:00:00Z`)
    : new Date();
  const [month, setMonth] = useState(
    () => new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1)),
  );
  const calendarRef = useRef<HTMLElement>(null);
  const cells = useMemo(() => {
    const firstDay = month.getUTCDay();
    const count = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    ).getUTCDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstDay + 1;
      if (day < 1 || day > count) return null;
      return `${monthKey(month)}-${String(day).padStart(2, '0')}`;
    });
  }, [month]);
  const byDate = new Map(points.map((point) => [point.dateKey, point]));
  const title = month.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  function move(delta: number) {
    setMonth(
      (current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)),
    );
  }
  function moveDayFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowDown'
            ? 7
            : event.key === 'ArrowUp'
              ? -7
              : 0;
    if (!step) return;
    event.preventDefault();
    let next = index + step;
    while (next >= 0 && next < cells.length) {
      const target = calendarRef.current?.querySelector<HTMLButtonElement>(
        `[data-calendar-index="${next}"]:not(:disabled)`,
      );
      if (target) {
        target.focus();
        return;
      }
      next += step > 0 ? 1 : -1;
    }
  }
  return (
    <section
      ref={calendarRef}
      className="overflow-hidden rounded-md border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]"
      aria-label="Trading calendar"
      data-dashboard-card="calendar"
    >
      <header className="flex h-[54px] items-center justify-between border-b border-border/70 px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Previous month"
            onClick={() => move(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Next month"
            onClick={() => move(1)}
          >
            <ChevronRight aria-hidden />
          </Button>
          <h2 className="ml-1 text-[15px] font-semibold" aria-live="polite">
            {title}
          </h2>
        </div>
        <DashboardInfoTip>
          Realized P&amp;L and closed-trade counts grouped by day in the workspace timezone.
          Populated days apply a real one-day Dashboard filter.
        </DashboardInfoTip>
      </header>
      <div
        key={monthKey(month)}
        className="motion-content-enter grid grid-cols-7 gap-px bg-border/70 p-px"
      >
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-muted/40 py-2 text-center text-[10px] font-semibold text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {cells.map((day, index) => {
          const point = day ? byDate.get(day) : null;
          return (
            <button
              key={`${day || 'empty'}-${index}`}
              type="button"
              disabled={!point}
              onClick={() => day && point && onSelectDay(day)}
              onKeyDown={(event) => moveDayFocus(event, index)}
              data-calendar-index={index}
              aria-label={
                day
                  ? point
                    ? `${day}, ${money(point.netPnl)}, ${point.tradeCount} trades`
                    : `${day}, no trades`
                  : undefined
              }
              className={cn(
                'relative min-h-[70px] bg-card p-2 text-left transition-colors duration-fast motion-reduce:transition-none 2xl:min-h-[76px]',
                point && point.netPnl > 0 && 'bg-profit/8 hover:bg-profit/14',
                point && point.netPnl < 0 && 'bg-loss/8 hover:bg-loss/14',
                point && point.netPnl === 0 && 'bg-muted/50',
                point ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              {day ? (
                <>
                  <span className="text-xs text-muted-foreground">{Number(day.slice(-2))}</span>
                  {point ? (
                    <div className="mt-1.5">
                      <p
                        className={cn(
                          'text-xs font-semibold tabular-nums',
                          point.netPnl > 0
                            ? 'text-profit'
                            : point.netPnl < 0
                              ? 'text-loss'
                              : 'text-foreground',
                        )}
                      >
                        {money(point.netPnl)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {point.tradeCount} {point.tradeCount === 1 ? 'trade' : 'trades'}
                      </p>
                      {point.hasNotes ? (
                        <>
                          <BookOpenText
                            className="absolute right-2 top-2 size-3 text-primary"
                            aria-hidden
                          />
                          <span className="sr-only">Has journal note</span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

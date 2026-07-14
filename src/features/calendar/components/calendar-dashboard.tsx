'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { FormSkeleton } from '@/features/workspace/components/states';
import { parseTradeQuery } from '@/features/journal/filters';
import { BreakdownTable } from '@/features/analytics/components/breakdown-table';
import { useCalendar } from '../hooks';
import { MONTH_LABELS } from '../time';
import type { HeatmapMetric } from '../types';
import { MonthGrid } from './month-grid';
import { CalendarHeatmap } from './calendar-heatmap';
import { StreakSummary } from './streak-summary';

export function CalendarDashboard() {
  const searchParams = useSearchParams();
  const { filters } = useMemo(
    () => parseTradeQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const query = useCalendar(filters);
  const [override, setOverride] = useState<{ year: number; month: number } | null>(null);
  const [metric, setMetric] = useState<HeatmapMetric>('net');

  const days = query.data?.summary?.days ?? [];
  const lastDay = days[days.length - 1]?.dateKey;
  const fallback = lastDay
    ? { year: Number(lastDay.slice(0, 4)), month: Number(lastDay.slice(5, 7)) }
    : { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() + 1 };
  const selected = override ?? fallback;

  function shiftMonth(delta: number) {
    let m = selected.month + delta;
    let y = selected.year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setOverride({ year: y, month: m });
  }

  const sessionRows =
    query.data?.summary?.sessions.map((s) => ({ key: s.id, label: s.label, kpis: s.kpis })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Calendar</h1>
        {query.data?.timezone ? (
          <span className="text-xs text-muted-foreground">Timezone: {query.data.timezone}</span>
        ) : null}
      </div>

      {query.isLoading ? (
        <FormSkeleton rows={6} />
      ) : query.isError ? (
        <FormAlert tone="error">Couldn&apos;t load your calendar. Please retry.</FormAlert>
      ) : !query.data?.summary || query.data.summary.days.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No trades yet. Log or import trades to see your performance calendar.
        </p>
      ) : (
        <>
          <StreakSummary streaks={query.data.summary.streaks} />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                {MONTH_LABELS[selected.month - 1]} {selected.year}
              </h2>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            </div>
            <MonthGrid days={days} year={selected.year} month={selected.month} />
          </section>

          <CalendarHeatmap days={days} metric={metric} onMetricChange={setMetric} />

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Sessions</h2>
            <p className="text-xs text-muted-foreground">
              Session windows overlap (a trade can count in London, New York, and the overlap), so
              session nets don&apos;t sum to the total.
            </p>
            <BreakdownTable rows={sessionRows} dimensionLabel="Session" />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">By hour</h2>
              <BreakdownTable rows={query.data.summary.hourly} dimensionLabel="Hour" />
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">By day of week</h2>
              <BreakdownTable rows={query.data.summary.dayOfWeek} dimensionLabel="Day" />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

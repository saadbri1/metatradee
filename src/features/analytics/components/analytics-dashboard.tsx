'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormAlert } from '@/features/auth/components/form-alert';
import { FormSkeleton } from '@/features/workspace/components/states';
import { parseTradeQuery, serializeTradeQuery } from '@/features/journal/filters';
import { useAnalytics } from '../hooks';
import type { BreakdownDimension } from '../types';
import { KpiGrid } from './kpi-grid';
import { EquityChart } from './equity-chart';
import { BreakdownTable } from './breakdown-table';

const DIMENSIONS: { value: BreakdownDimension; label: string }[] = [
  { value: 'symbol', label: 'Symbol' },
  { value: 'direction', label: 'Direction' },
  { value: 'session', label: 'Session' },
  { value: 'dayOfWeek', label: 'Day of week' },
  { value: 'hourOfDay', label: 'Hour of day' },
  { value: 'month', label: 'Month' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'asset', label: 'Asset class' },
  { value: 'source', label: 'Manual vs imported' },
];

export function AnalyticsDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters, sort } = useMemo(
    () => parseTradeQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [dimension, setDimension] = useState<BreakdownDimension>('symbol');
  const query = useAnalytics(filters, dimension);

  function setDate(key: 'date_from' | 'date_to', value: string) {
    const iso = value ? new Date(value).toISOString() : undefined;
    const qs = serializeTradeQuery({ ...filters, [key]: iso }, sort);
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  const dimLabel = DIMENSIONS.find((d) => d.value === dimension)?.label ?? 'Group';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Analytics</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input
              id="from"
              type="date"
              className="w-40"
              onChange={(e) => setDate('date_from', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">
              To
            </Label>
            <Input
              id="to"
              type="date"
              className="w-40"
              onChange={(e) => setDate('date_to', e.target.value)}
            />
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <FormSkeleton rows={6} />
      ) : query.isError ? (
        <FormAlert tone="error">Couldn&apos;t load analytics. Please retry.</FormAlert>
      ) : !query.data?.summary || query.data.summary.kpis.totalTrades === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No trades match these filters. Log or import trades to see your analytics.
        </p>
      ) : (
        <>
          <KpiGrid kpis={query.data.summary.kpis} advanced={query.data.summary.advanced} />

          <EquityChart points={query.data.summary.equityCurve} />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">Breakdown</h2>
              <Select
                value={dimension}
                onValueChange={(v) => setDimension(v as BreakdownDimension)}
              >
                <SelectTrigger className="w-48" aria-label="Break down by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIMENSIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <BreakdownTable rows={query.data.breakdown} dimensionLabel={dimLabel} />
          </section>

          {query.data.summary.advanced.notes.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {query.data.summary.advanced.notes.join(' ')}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

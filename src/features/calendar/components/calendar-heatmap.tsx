'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addDays, dayDiff } from '../time';
import type { CalendarDay, HeatmapMetric } from '../types';

const METRICS: { value: HeatmapMetric; label: string }[] = [
  { value: 'net', label: 'Net P&L' },
  { value: 'trades', label: 'Trade count' },
  { value: 'winRate', label: 'Win rate' },
];

function metricValue(d: CalendarDay, m: HeatmapMetric): number {
  if (m === 'net') return d.kpis.netProfit;
  if (m === 'trades') return d.kpis.totalTrades;
  return d.kpis.winRate ?? 0;
}

/** Token-driven color for a day cell (no hardcoded colors — uses design vars). */
function cellStyle(value: number, max: number, metric: HeatmapMetric): string {
  if (max === 0) return 'hsl(var(--muted))';
  const intensity = Math.min(1, Math.abs(value) / max);
  const op = (0.15 + intensity * 0.7).toFixed(2);
  if (metric === 'net') {
    if (value > 0) return `hsl(var(--profit) / ${op})`;
    if (value < 0) return `hsl(var(--loss) / ${op})`;
    return 'hsl(var(--muted))';
  }
  return value > 0 ? `hsl(var(--primary) / ${op})` : 'hsl(var(--muted))';
}

/**
 * GitHub-style calendar heatmap. Token-driven colors (dark/light aware), with a
 * required accessible alternative (summary + keyboard-reachable data table).
 */
export function CalendarHeatmap({
  days,
  metric,
  onMetricChange,
}: {
  days: CalendarDay[];
  metric: HeatmapMetric;
  onMetricChange: (m: HeatmapMetric) => void;
}) {
  const byDate = new Map(days.map((d) => [d.dateKey, d]));
  const sorted = [...days].sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
  const first = sorted[0]?.dateKey;
  const last = sorted[sorted.length - 1]?.dateKey;

  const range: string[] = [];
  if (first && last) {
    const span = Math.min(dayDiff(first, last), 366);
    for (let i = 0; i <= span; i++) range.push(addDays(first, i));
  }

  const max = Math.max(0, ...days.map((d) => Math.abs(metricValue(d, metric))));
  const summary =
    days.length === 0
      ? 'No trades to display.'
      : `${metric} heatmap over ${days.length} trading days from ${first} to ${last}.`;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Activity heatmap</CardTitle>
        <Select value={metric} onValueChange={(v) => onMetricChange(v as HeatmapMetric)}>
          <SelectTrigger className="w-36" aria-label="Heatmap metric">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRICS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-2">
        {range.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No trades in this range.</p>
        ) : (
          <div
            className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto"
            role="img"
            aria-label={summary}
          >
            {range.map((dk) => {
              const d = byDate.get(dk);
              const v = d ? metricValue(d, metric) : 0;
              return (
                <span
                  key={dk}
                  title={d ? `${dk}: ${v}` : dk}
                  className="size-3 rounded-sm border border-border/40"
                  style={{ backgroundColor: d ? cellStyle(v, max, metric) : 'hsl(var(--muted))' }}
                />
              );
            })}
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Show data table</summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">{summary}</caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col">Day</th>
                  <th scope="col" className="text-right">
                    Trades
                  </th>
                  <th scope="col" className="text-right">
                    Net P&amp;L
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.dateKey} className="border-t border-border">
                    <td>{d.dateKey}</td>
                    <td className="tabular text-right">{d.kpis.totalTrades}</td>
                    <td className="tabular text-right">{d.kpis.netProfit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

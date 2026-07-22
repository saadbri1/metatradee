'use client';

import { cn } from '@/lib/utils';
import type { DashboardProjection } from '../types';
import { DashboardInfoTip } from './dashboard-info-tip';

function money(value: number | null, currency: string): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function number(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function PerformanceSummary({
  projection,
  currency,
}: {
  projection: DashboardProjection;
  currency: string;
}) {
  const hasTrades = projection.closedTrades.length > 0;
  const statistics = [
    {
      label: 'Profit Factor',
      value: number(projection.kpis.profitFactor),
      info: 'Gross winning realized P&L divided by the absolute gross losing realized P&L. It is unavailable when there are no losing closed trades.',
      tone: 'neutral' as const,
    },
    {
      label: 'Average Winning Trade',
      value: money(projection.performance.averageWinningTrade, currency),
      info: 'Average realized P&L across profitable closed trades matching the shared Dashboard filters.',
      tone: 'profit' as const,
    },
    {
      label: 'Average Losing Trade',
      value: money(projection.performance.averageLosingTrade, currency),
      info: 'Average realized P&L across losing closed trades, displayed as a signed negative value.',
      tone: 'loss' as const,
    },
  ];

  return (
    <section
      aria-label="Performance summary"
      className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2.05fr)]"
      data-dashboard-layout="performance-summary"
    >
      <article className="flex min-h-[112px] flex-col justify-center rounded-md border border-border/70 bg-card px-5 py-4 shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Total Net P&amp;L</span>
          <DashboardInfoTip>
            Realized net profit and loss from closed trades matching the shared account, date,
            symbol, side, source, result, and account-type filters.
          </DashboardInfoTip>
        </div>
        <p
          className={cn(
            'mt-1 text-[28px] font-semibold tabular-nums tracking-tight',
            hasTrades && projection.kpis.netProfit > 0 && 'text-profit',
            hasTrades && projection.kpis.netProfit < 0 && 'text-loss',
          )}
        >
          {hasTrades ? money(projection.kpis.netProfit, currency) : '—'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {hasTrades
            ? `${projection.closedTrades.length.toLocaleString()} closed ${projection.closedTrades.length === 1 ? 'trade' : 'trades'}`
            : 'No closed trades'}
        </p>
      </article>

      <article className="grid min-h-[112px] rounded-md border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)] sm:grid-cols-3">
        {statistics.map((statistic, index) => (
          <div
            key={statistic.label}
            className={cn(
              'flex min-w-0 flex-col justify-center px-5 py-4',
              index > 0 && 'border-t border-border/70 sm:border-l sm:border-t-0',
            )}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="truncate">{statistic.label}</span>
              <DashboardInfoTip>{statistic.info}</DashboardInfoTip>
            </div>
            <p
              className={cn(
                'mt-1.5 truncate text-[24px] font-semibold tabular-nums tracking-tight',
                statistic.tone === 'profit' && statistic.value !== '—' && 'text-profit',
                statistic.tone === 'loss' && statistic.value !== '—' && 'text-loss',
              )}
            >
              {statistic.value}
            </p>
          </div>
        ))}
      </article>
    </section>
  );
}

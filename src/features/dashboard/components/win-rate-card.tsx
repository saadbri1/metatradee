'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { DashboardProjection } from '../types';
import { DashboardInfoTip } from './dashboard-info-tip';

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function Donut({
  percentage,
  winners,
  losers,
  neutral,
  label,
}: {
  percentage: number | null;
  winners: number;
  losers: number;
  neutral: number;
  label: string;
}) {
  const total = winners + losers + neutral;
  const winStop = total > 0 ? (winners / total) * 100 : 0;
  const lossStop = total > 0 ? winStop + (losers / total) * 100 : 0;
  const style = {
    '--dashboard-donut':
      total > 0
        ? `conic-gradient(hsl(var(--profit)) 0 ${winStop}%, hsl(var(--loss)) ${winStop}% ${lossStop}%, hsl(var(--muted)) ${lossStop}% 100%)`
        : 'conic-gradient(hsl(var(--muted)) 0 100%)',
  } as CSSProperties;

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-8 px-4 py-5 sm:px-8">
      <div
        className="motion-chart-reveal relative grid size-[174px] shrink-0 place-items-center rounded-full bg-[image:var(--dashboard-donut)] p-[12px] motion-reduce:transition-none"
        style={style}
        role="img"
        aria-label={`${label}. ${percentage === null ? 'No eligible data' : `${percent(percentage)} win rate`}. ${winners} winners, ${losers} losers${neutral > 0 ? `, ${neutral} break-even or flat` : ''}.`}
      >
        <div className="grid size-full place-items-center rounded-full bg-card text-center shadow-[inset_0_0_0_1px_hsl(var(--border)/.45)]">
          <div>
            <p
              className={cn(
                'text-[34px] font-semibold tabular-nums tracking-tight',
                percentage !== null ? 'text-profit' : 'text-muted-foreground',
              )}
            >
              {percent(percentage)}
            </p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Win rate
            </p>
          </div>
        </div>
      </div>

      <dl className="min-w-[112px] space-y-5">
        <div className="flex items-center gap-2.5">
          <span className="size-5 rounded bg-profit" aria-hidden />
          <div>
            <dt className="text-xs text-muted-foreground">Winners</dt>
            <dd className="text-xl font-semibold tabular-nums">{winners}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="size-5 rounded bg-loss" aria-hidden />
          <div>
            <dt className="text-xs text-muted-foreground">Losers</dt>
            <dd className="text-xl font-semibold tabular-nums">{losers}</dd>
          </div>
        </div>
        {neutral > 0 ? (
          <div className="flex items-center gap-2.5">
            <span className="size-5 rounded bg-muted" aria-hidden />
            <div>
              <dt className="text-xs text-muted-foreground">
                {label.includes('Days') ? 'Flat' : 'Break-even'}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">{neutral}</dd>
            </div>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function WinRateCard({
  kind,
  projection,
}: {
  kind: 'trades' | 'days';
  projection: DashboardProjection;
}) {
  const byTrades = kind === 'trades';
  const title = byTrades ? 'Winning % by Trades' : 'Winning % by Days';
  const percentage = byTrades
    ? projection.performance.winningTradePercentage
    : projection.performance.winningDayPercentage;
  const winners = byTrades ? projection.kpis.wins : projection.performance.profitableDays;
  const losers = byTrades ? projection.kpis.losses : projection.performance.losingDays;
  const neutral = byTrades ? projection.kpis.breakEven : projection.performance.flatDays;
  const info = byTrades
    ? 'Winning closed trades divided by all eligible closed trades with recorded realized P&L. Break-even trades remain in the denominator and appear as the neutral donut segment.'
    : 'Profitable trading days divided by days containing eligible closed trades in the workspace timezone. Flat days remain in the denominator; no-trade days are excluded.';

  return (
    <section
      className="motion-content-enter flex min-h-[288px] flex-col overflow-hidden rounded-md border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]"
      data-dashboard-card={byTrades ? 'winning-trades' : 'winning-days'}
    >
      <header className="flex h-[54px] shrink-0 items-center justify-between border-b border-border/70 px-5">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        <DashboardInfoTip>{info}</DashboardInfoTip>
      </header>
      <Donut
        percentage={percentage}
        winners={winners}
        losers={losers}
        neutral={neutral}
        label={title}
      />
    </section>
  );
}

'use client';

import type { CSSProperties } from 'react';
import { BarChart3, CircleDollarSign } from 'lucide-react';
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

function ratio(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(2)}%`;
}

/**
 * Semicircular gauge for profit factor. A factor of 1 (break-even) sits at the
 * midpoint; the arc is entirely neutral when there is no eligible data.
 */
function ProfitFactorGauge({ value }: { value: number | null }) {
  const LENGTH = 138.2; // π × r, r = 44
  const fraction = value === null ? null : Math.max(0, Math.min(1, value / (value + 1)));
  const filled = fraction === null ? 0 : fraction * LENGTH;

  return (
    <svg
      viewBox="0 0 100 56"
      className="h-[46px] w-[80px] shrink-0 overflow-visible"
      role="img"
      aria-label={
        value === null
          ? 'Profit factor unavailable'
          : `Profit factor ${ratio(value)} of a break-even factor of 1`
      }
    >
      <path
        d="M6,50 A44,44 0 0 1 94,50"
        fill="none"
        stroke="hsl(var(--loss))"
        strokeWidth="9"
        strokeLinecap="round"
        opacity={value === null ? 0.18 : 0.85}
      />
      {fraction !== null ? (
        <path
          d="M6,50 A44,44 0 0 1 94,50"
          fill="none"
          stroke="hsl(var(--profit))"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${LENGTH}`}
        />
      ) : null}
    </svg>
  );
}

/** Win-rate donut sized for the compact KPI card. */
function WinRateDonut({
  percentage,
  wins,
  losses,
  breakEven,
}: {
  percentage: number | null;
  wins: number;
  losses: number;
  breakEven: number;
}) {
  const total = wins + losses + breakEven;
  const winStop = total > 0 ? (wins / total) * 100 : 0;
  const lossStop = total > 0 ? winStop + (losses / total) * 100 : 0;
  const style = {
    '--dashboard-kpi-donut':
      total > 0
        ? `conic-gradient(hsl(var(--profit)) 0 ${winStop}%, hsl(var(--loss)) ${winStop}% ${lossStop}%, hsl(var(--muted)) ${lossStop}% 100%)`
        : 'conic-gradient(hsl(var(--muted)) 0 100%)',
  } as CSSProperties;

  return (
    <div
      className="grid size-[52px] shrink-0 place-items-center rounded-full bg-[image:var(--dashboard-kpi-donut)] p-[7px]"
      style={style}
      role="img"
      aria-label={
        percentage === null
          ? 'Win rate unavailable'
          : `Win rate ${percent(percentage)}. ${wins} winners, ${losses} losers${breakEven > 0 ? `, ${breakEven} break-even` : ''}.`
      }
    >
      <span className="size-full rounded-full bg-card" />
    </div>
  );
}

/** Proportional win/loss magnitude bar with the two real averages beneath. */
function WinLossBar({
  averageWin,
  averageLoss,
  currency,
}: {
  averageWin: number | null;
  averageLoss: number | null;
  currency: string;
}) {
  const win = averageWin ?? 0;
  const loss = Math.abs(averageLoss ?? 0);
  const total = win + loss;
  const winPercent = total > 0 ? (win / total) * 100 : 50;

  return (
    <div className="min-w-0 flex-1">
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={
          total > 0
            ? `Average winning trade ${money(averageWin, currency)} against average losing trade ${money(averageLoss, currency)}`
            : 'Average win and loss unavailable'
        }
      >
        {total > 0 ? (
          <>
            <span className="bg-profit" style={{ width: `${winPercent}%` }} />
            <span className="bg-loss" style={{ width: `${100 - winPercent}%` }} />
          </>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] tabular-nums">
        <span className="truncate text-profit">{money(averageWin, currency)}</span>
        <span className="truncate text-loss">{money(averageLoss, currency)}</span>
      </div>
    </div>
  );
}

function KpiShell({
  label,
  info,
  badges,
  children,
}: {
  label: string;
  info: string;
  badges?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[112px] flex-col justify-center gap-2.5 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        <DashboardInfoTip>{info}</DashboardInfoTip>
        {badges}
      </div>
      {children}
    </div>
  );
}

function CountBadge({ value, tone }: { value: number; tone: 'profit' | 'loss' }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
        tone === 'profit' ? 'bg-profit/12 text-profit' : 'bg-loss/12 text-loss',
      )}
    >
      {value}
    </span>
  );
}

/**
 * The five compact metric cards. Every value is derived from the shared
 * projection; nothing is shown when the underlying metric is unavailable.
 */
export function kpiWidgetContent(
  id: string,
  projection: DashboardProjection,
  currency: string,
): React.ReactNode {
  const { kpis, performance } = projection;
  const hasTrades = kpis.totalTrades > 0;

  if (id === 'net-pnl') {
    return (
      <KpiShell
        label="Net P&L"
        info="Realized net P&L from closed trades after recorded fees, for the trades matching the shared Dashboard filters."
        badges={
          hasTrades ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {kpis.totalTrades}
            </span>
          ) : null
        }
      >
        <div className="flex items-end justify-between gap-3">
          <p
            className={cn(
              'text-2xl font-semibold tabular-nums tracking-tight',
              hasTrades && kpis.netProfit > 0 && 'text-profit',
              hasTrades && kpis.netProfit < 0 && 'text-loss',
            )}
          >
            {hasTrades ? money(kpis.netProfit, currency) : '—'}
          </p>
          <span className="bg-primary/8 grid size-9 shrink-0 place-items-center rounded-lg text-primary">
            <CircleDollarSign className="size-4" aria-hidden />
          </span>
        </div>
      </KpiShell>
    );
  }

  if (id === 'trade-expectancy') {
    return (
      <KpiShell
        label="Trade Expectancy"
        info="Realized net P&L divided by every closed trade, including break-even trades."
      >
        <div className="flex items-end justify-between gap-3">
          <p
            className={cn(
              'text-2xl font-semibold tabular-nums tracking-tight',
              kpis.expectancy !== null && kpis.expectancy > 0 && 'text-profit',
              kpis.expectancy !== null && kpis.expectancy < 0 && 'text-loss',
            )}
          >
            {kpis.expectancy === null ? '—' : money(kpis.expectancy, currency)}
          </p>
          <span className="bg-primary/8 grid size-9 shrink-0 place-items-center rounded-lg text-primary">
            <BarChart3 className="size-4" aria-hidden />
          </span>
        </div>
      </KpiShell>
    );
  }

  if (id === 'profit-factor') {
    return (
      <KpiShell
        label="Profit Factor"
        info="Gross winning P&L divided by the absolute gross losing P&L. Unavailable when there are no losing closed trades."
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {ratio(kpis.profitFactor)}
          </p>
          <ProfitFactorGauge value={kpis.profitFactor} />
        </div>
      </KpiShell>
    );
  }

  if (id === 'win-rate') {
    return (
      <KpiShell
        label="Win %"
        info="Winning closed trades divided by all closed trades with a recorded net P&L. Break-even trades remain in the denominator."
        badges={
          hasTrades ? (
            <span className="flex items-center gap-1">
              <CountBadge value={kpis.wins} tone="profit" />
              <CountBadge value={kpis.losses} tone="loss" />
            </span>
          ) : null
        }
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {percent(performance.winningTradePercentage)}
          </p>
          <WinRateDonut
            percentage={performance.winningTradePercentage}
            wins={kpis.wins}
            losses={kpis.losses}
            breakEven={kpis.breakEven}
          />
        </div>
      </KpiShell>
    );
  }

  return (
    <KpiShell
      label="Avg win/loss trade"
      info="Average winning trade divided by the magnitude of the average losing trade. The amounts below are the two real averages."
    >
      <div className="flex items-center gap-3">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {ratio(performance.averageWinLossRatio)}
        </p>
        <WinLossBar
          averageWin={performance.averageWinningTrade}
          averageLoss={performance.averageLosingTrade}
          currency={currency}
        />
      </div>
    </KpiShell>
  );
}

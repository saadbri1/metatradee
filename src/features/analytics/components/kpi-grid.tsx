import { Money, Rr } from '@/features/journal/components/pnl';
import type { AdvancedMetrics, Kpis } from '../types';
import { StatCard } from './stat-card';

function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`;
}
function num(v: number | null, dp = 2): string {
  return v === null ? '—' : v.toFixed(dp);
}
function dur(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** KPI + advanced-metric grid. Every value is text (P&L never color-only). */
export function KpiGrid({ kpis, advanced }: { kpis: Kpis; advanced: AdvancedMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      <StatCard label="Net P&L" value={<Money value={kpis.netProfit} colored />} />
      <StatCard
        label="Win rate"
        value={pct(kpis.winRate)}
        context={`${kpis.wins}W / ${kpis.losses}L`}
      />
      <StatCard label="Profit factor" value={num(kpis.profitFactor)} />
      <StatCard label="Expectancy" value={<Money value={kpis.expectancy} colored />} />
      <StatCard label="Avg win" value={<Money value={kpis.avgWin} />} />
      <StatCard label="Avg loss" value={<Money value={kpis.avgLoss} />} />
      <StatCard label="Largest win" value={<Money value={kpis.largestWin} />} />
      <StatCard label="Largest loss" value={<Money value={kpis.largestLoss} />} />
      <StatCard label="Avg R:R" value={<Rr value={kpis.avgRr} />} />
      <StatCard label="Trades" value={kpis.totalTrades} context={`${kpis.tradingDays} days`} />
      <StatCard label="Avg hold" value={dur(kpis.avgHoldingSeconds)} />
      <StatCard label="Max win streak" value={kpis.maxConsecutiveWins} />
      <StatCard label="Sharpe" value={num(advanced.sharpe, 2)} context="per-trade" />
      <StatCard label="Sortino" value={num(advanced.sortino, 2)} context="per-trade" />
      <StatCard label="Calmar" value={num(advanced.calmar, 2)} />
      <StatCard label="Recovery factor" value={num(advanced.recoveryFactor, 2)} />
      <StatCard
        label="Kelly"
        value={advanced.kelly === null ? '—' : `${(advanced.kelly * 100).toFixed(1)}%`}
      />
      <StatCard
        label="Risk of ruin"
        value={advanced.riskOfRuin === null ? '—' : `${(advanced.riskOfRuin * 100).toFixed(1)}%`}
      />
      <StatCard
        label="Profit consistency"
        value={advanced.profitConsistency === null ? '—' : `${advanced.profitConsistency}%`}
      />
      <StatCard label="Expectancy score" value={num(advanced.expectancyScore, 2)} />
    </div>
  );
}

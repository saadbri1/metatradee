/**
 * Deterministic, data-cited insights. Pure and unit-tested. Every insight is a
 * factual observation over the FILTERED real data with the supporting metric
 * attached — never a prediction, recommendation, or causal claim. Groups below
 * a minimum sample size are reported as low-confidence, not as findings.
 */
import type { AnalyticsWorkspaceData, BreakdownRow } from './types';

export interface Insight {
  id: string;
  text: string;
  /** The exact metric behind the statement, shown in the UI. */
  metric: string;
  tone: 'positive' | 'negative' | 'neutral';
  lowSample?: boolean;
}

const MIN_SAMPLE = 5;

function money(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}
function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`;
}

/** Best/worst decided group by net P&L among groups with enough decided trades. */
function extremes(rows: BreakdownRow[]): { best?: BreakdownRow; worst?: BreakdownRow } {
  const eligible = rows.filter((r) => r.kpis.wins + r.kpis.losses + r.kpis.breakEven >= 1);
  if (eligible.length === 0) return {};
  const sorted = [...eligible].sort((a, b) => b.kpis.netProfit - a.kpis.netProfit);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export function buildInsights(data: AnalyticsWorkspaceData): Insight[] {
  const out: Insight[] = [];
  const summary = data.summary;
  if (!summary || summary.kpis.totalTrades === 0) return out;

  // Strongest symbol by net P&L.
  const symbols = data.breakdowns.symbol ?? [];
  const bestSymbol = extremes(symbols).best;
  if (bestSymbol) {
    out.push({
      id: 'best-symbol',
      text: `Your strongest symbol by net P&L is ${bestSymbol.label}.`,
      metric: `Net P&L ${money(bestSymbol.kpis.netProfit)} across ${bestSymbol.kpis.totalTrades} trades`,
      tone: bestSymbol.kpis.netProfit >= 0 ? 'positive' : 'negative',
      lowSample: bestSymbol.kpis.totalTrades < MIN_SAMPLE,
    });
  }

  // Best weekday by expectancy.
  const dow = (data.breakdowns.dayOfWeek ?? []).filter(
    (r) => r.kpis.expectancy !== null && r.kpis.totalTrades >= 1,
  );
  if (dow.length > 0) {
    const best = [...dow].sort((a, b) => (b.kpis.expectancy ?? 0) - (a.kpis.expectancy ?? 0))[0]!;
    out.push({
      id: 'best-weekday',
      text: `${best.label} has your highest expectancy per trade.`,
      metric: `Expectancy ${money(best.kpis.expectancy ?? 0)} over ${best.kpis.totalTrades} trades`,
      tone: (best.kpis.expectancy ?? 0) >= 0 ? 'positive' : 'neutral',
      lowSample: best.kpis.totalTrades < MIN_SAMPLE,
    });
  }

  // Long vs short win rate.
  const dir = data.breakdowns.direction ?? [];
  const long = dir.find((r) => r.key === 'buy');
  const short = dir.find((r) => r.key === 'sell');
  if (long && short && long.kpis.winRate !== null && short.kpis.winRate !== null) {
    const longer = long.kpis.winRate >= short.kpis.winRate;
    out.push({
      id: 'side-winrate',
      text: `${longer ? 'Long' : 'Short'} trades have a higher win rate than ${longer ? 'short' : 'long'} trades.`,
      metric: `Long ${pct(long.kpis.winRate)} vs Short ${pct(short.kpis.winRate)}`,
      tone: 'neutral',
      lowSample: Math.min(long.kpis.totalTrades, short.kpis.totalTrades) < MIN_SAMPLE,
    });
  }

  // Costliest mistake tag.
  const mistakes = data.tags.filter((t) => t.category === 'mistake');
  if (mistakes.length > 0) {
    const worst = [...mistakes].sort((a, b) => a.netPnl - b.netPnl)[0]!;
    if (worst.netPnl < 0) {
      out.push({
        id: 'mistake-cost',
        text: `Trades tagged “${worst.name}” are associated with your lowest net result among mistake tags.`,
        metric: `Net P&L ${money(worst.netPnl)} across ${worst.count} tagged trades (association, not cause)`,
        tone: 'negative',
        lowSample: worst.count < MIN_SAMPLE,
      });
    }
  }

  // Drawdown context.
  if (summary.drawdown.maxDrawdown > 0) {
    out.push({
      id: 'max-drawdown',
      text: `Your largest peak-to-trough decline in this range was ${money(summary.drawdown.maxDrawdown)}.`,
      metric: `Max drawdown over ${summary.drawdown.maxDrawdownDurationTrades} trades`,
      tone: 'neutral',
    });
  }

  return out;
}

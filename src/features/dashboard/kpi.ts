/**
 * Dashboard KPI presentation (Phase 10.0). This is a THIN presentation layer over
 * the 9.8 analytics engine — it consumes `Kpis` produced by `computeKpis` and
 * formats them for the overview cards. It defines NO financial formulas of its
 * own (no duplicate Analytics Engine); `currentStreak` is a display derivation
 * over already-computed `net_pnl`, not a P&L calculation.
 */
import type { Kpis } from '@/features/analytics';

export interface KpiCard {
  id: string;
  label: string;
  /** Preformatted display value (tabular numerals in the UI). */
  value: string;
  /** Sign for the profit/loss semantic token: +1 profit, -1 loss, 0 neutral. */
  tone: -1 | 0 | 1;
  /** Screen-reader description (KPI values must be SR-friendly). */
  srLabel: string;
}

/** Current consecutive win/loss streak from the tail of the decided trades. */
export function currentStreak(orderedNets: (number | null)[]): {
  count: number;
  kind: 'win' | 'loss' | 'none';
} {
  const decided = orderedNets.filter((n): n is number => n !== null && n !== 0);
  if (decided.length === 0) return { count: 0, kind: 'none' };
  const lastSign = Math.sign(decided[decided.length - 1] as number);
  let count = 0;
  for (let i = decided.length - 1; i >= 0; i--) {
    if (Math.sign(decided[i] as number) === lastSign) count++;
    else break;
  }
  return { count, kind: lastSign > 0 ? 'win' : 'loss' };
}

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}
function num(v: number | null): string {
  return v === null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Build the six overview cards from engine KPIs. `streak` is passed in (derived
 * from the same trade set) so this stays pure. Empty/zero states render honestly
 * (`—` or `0`), never fabricated numbers.
 */
export function buildKpiCards(
  kpis: Kpis,
  streak: { count: number; kind: 'win' | 'loss' | 'none' },
): KpiCard[] {
  const netTone: -1 | 0 | 1 = kpis.netProfit > 0 ? 1 : kpis.netProfit < 0 ? -1 : 0;
  const streakTone: -1 | 0 | 1 = streak.kind === 'win' ? 1 : streak.kind === 'loss' ? -1 : 0;
  const streakValue =
    streak.kind === 'none' ? '—' : `${streak.count} ${streak.kind === 'win' ? 'W' : 'L'}`;

  return [
    {
      id: 'net-pnl',
      label: 'Net P&L',
      value: num(kpis.netProfit),
      tone: netTone,
      srLabel: `Net profit and loss ${num(kpis.netProfit)}`,
    },
    {
      id: 'win-rate',
      label: 'Win rate',
      value: pct(kpis.winRate),
      tone: 0,
      srLabel: `Win rate ${pct(kpis.winRate)}`,
    },
    {
      id: 'total-trades',
      label: 'Total trades',
      value: kpis.totalTrades.toLocaleString('en-US'),
      tone: 0,
      srLabel: `${kpis.totalTrades} total trades`,
    },
    {
      id: 'profit-factor',
      label: 'Profit factor',
      value: num(kpis.profitFactor),
      tone: kpis.profitFactor === null ? 0 : kpis.profitFactor >= 1 ? 1 : -1,
      srLabel: `Profit factor ${num(kpis.profitFactor)}`,
    },
    {
      id: 'current-streak',
      label: 'Current streak',
      value: streakValue,
      tone: streakTone,
      srLabel:
        streak.kind === 'none'
          ? 'No current streak'
          : `Current streak ${streak.count} ${streak.kind === 'win' ? 'wins' : 'losses'}`,
    },
    {
      id: 'avg-rr',
      label: 'Avg R:R',
      value: num(kpis.avgRr),
      tone: 0,
      srLabel: `Average risk to reward ${num(kpis.avgRr)}`,
    },
  ];
}

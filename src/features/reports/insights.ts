/**
 * Insights Center — deterministic/statistical highlights derived from the 9.8
 * engine outputs (NOT recomputed: it reads Kpis/BreakdownRow the engine already
 * produced). AI narration is carried through from 9.12 unchanged (evidence +
 * confidence preserved); nothing is fabricated. Empty inputs → empty insights,
 * honestly.
 */
import type { AnalyticsSummary, BreakdownRow } from '@/features/analytics';

export type InsightKind =
  'top_win' | 'biggest_mistake' | 'highlight' | 'risk_summary' | 'best_session' | 'weak_session';

export interface Insight {
  kind: InsightKind;
  title: string;
  detail: string;
  /** Supporting figure copied from the engine (reconciles with the app). */
  value: number | null;
}

/** Best/worst group in a breakdown by net P&L (engine numbers, min sample 3). */
function extremes(rows: BreakdownRow[]): { best: BreakdownRow | null; worst: BreakdownRow | null } {
  const eligible = rows.filter((r) => r.kpis.totalTrades >= 3);
  if (eligible.length === 0) return { best: null, worst: null };
  const sorted = [...eligible].sort((a, b) => b.kpis.netProfit - a.kpis.netProfit);
  return { best: sorted[0] ?? null, worst: sorted[sorted.length - 1] ?? null };
}

export interface InsightInputs {
  analytics: AnalyticsSummary | null;
  sessionBreakdown?: BreakdownRow[];
  symbolBreakdown?: BreakdownRow[];
}

export function computeInsights(input: InsightInputs): Insight[] {
  const out: Insight[] = [];
  const a = input.analytics;
  if (!a) return out;
  const k = a.kpis;

  // Performance highlight.
  if (k.totalTrades > 0) {
    out.push({
      kind: 'highlight',
      title: k.netProfit >= 0 ? 'Net positive over this scope' : 'Net negative over this scope',
      detail: `${k.totalTrades} trades, ${k.winRate === null ? 'n/a' : `${Math.round(k.winRate * 100)}%`} win rate.`,
      value: k.netProfit,
    });
  }

  // Top win / biggest mistake by symbol.
  const sym = extremes(input.symbolBreakdown ?? []);
  if (sym.best && sym.best.kpis.netProfit > 0) {
    out.push({
      kind: 'top_win',
      title: `Strongest symbol: ${sym.best.label}`,
      detail: `${sym.best.kpis.totalTrades} trades, net ${sym.best.kpis.netProfit}.`,
      value: sym.best.kpis.netProfit,
    });
  }
  if (sym.worst && sym.worst.kpis.netProfit < 0) {
    out.push({
      kind: 'biggest_mistake',
      title: `Weakest symbol: ${sym.worst.label}`,
      detail: `${sym.worst.kpis.totalTrades} trades, net ${sym.worst.kpis.netProfit}. Worth reviewing — not a verdict.`,
      value: sym.worst.kpis.netProfit,
    });
  }

  // Session comparison.
  const sess = extremes(input.sessionBreakdown ?? []);
  if (sess.best && sess.best !== sess.worst) {
    out.push({
      kind: 'best_session',
      title: `Best session: ${sess.best.label}`,
      detail: `Net ${sess.best.kpis.netProfit} over ${sess.best.kpis.totalTrades} trades.`,
      value: sess.best.kpis.netProfit,
    });
  }

  // Risk summary (surfaces missing-risk data honestly).
  if (a.risk.tradesMissingRisk > 0) {
    out.push({
      kind: 'risk_summary',
      title: 'Some trades are missing risk data',
      detail: `${a.risk.tradesMissingRisk} of ${a.risk.tradesWithRisk + a.risk.tradesMissingRisk} trades have no recorded risk — risk stats cover only those that do.`,
      value: a.risk.tradesMissingRisk,
    });
  }

  return out;
}

/**
 * Deterministic pattern detection. Patterns are found FROM DATA here — the LLM
 * only prioritizes and explains them, it never invents a pattern. Every detector
 * reuses the 9.8 engines (computeKpis/computeBreakdown) so figures reconcile
 * with Analytics by construction; no PnL/win-rate math is redefined.
 *
 * Tone is wellbeing-first: summaries are observational and non-shaming
 * ("your data shows…"), never moralizing.
 */
import { computeKpis, computeBreakdown } from '@/features/analytics';
import type { AnalyticsTrade } from '@/features/analytics';
import { fact } from './evidence';
import type { DetectedPattern, SupportingFact } from './types';

export interface PatternInputs {
  trades: AnalyticsTrade[];
  /** Distinct trading days in scope (from the 9.9 calendar day rules). */
  tradingDays?: number;
  /** Count of rule violations from 9.10 trade_strategy_adherence (not recomputed). */
  ruleViolations?: number;
  /** Trade ids that violated a rule (for EvidenceLink). */
  violationTradeIds?: string[];
  /** Overtrading threshold (avg trades/day). Configurable default. */
  overtradingPerDay?: number;
}

const DEFAULT_OVERTRADING = 10;

/** avg trades/day above threshold → overtrading (informational, not a scolding). */
function detectOvertrading(input: PatternInputs): DetectedPattern | null {
  const kpis = computeKpis(input.trades);
  const perDay = kpis.avgTradesPerDay;
  const threshold = input.overtradingPerDay ?? DEFAULT_OVERTRADING;
  if (perDay === null || perDay < threshold) return null;
  return {
    kind: 'overtrading',
    summary: `Your data shows an average of ${perDay} trades per active day, above your ${threshold}/day marker. Higher frequency can dilute focus.`,
    severity: 'watch',
    facts: [fact('Avg trades/day', perDay), fact('Total trades', kpis.totalTrades)],
    referencedTradeIds: [],
  };
}

/**
 * Revenge trading: a loss immediately followed by another trade opened within a
 * short window. Uses opened/closed timestamps only (no PnL redefinition).
 */
function detectRevengeTrading(input: PatternInputs, windowMinutes = 10): DetectedPattern | null {
  const ordered = [...input.trades]
    .filter((t) => t.closed_at && t.opened_at)
    .sort((a, b) => (a.opened_at as string).localeCompare(b.opened_at as string));
  const flagged: string[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    if (!prev || !cur) continue;
    const prevLoss = prev.net_pnl !== null && prev.net_pnl < 0;
    const gapMs =
      new Date(cur.opened_at as string).getTime() - new Date(prev.closed_at as string).getTime();
    if (prevLoss && gapMs >= 0 && gapMs <= windowMinutes * 60_000) flagged.push(cur.id);
  }
  if (flagged.length < 2) return null;
  return {
    kind: 'revenge_trading',
    summary: `On ${flagged.length} occasions you re-entered within ${windowMinutes} minutes of a losing trade. A short pause after a loss can help you reset — nothing here is a failure.`,
    severity: 'attention',
    facts: [fact('Quick re-entries after a loss', flagged.length)],
    referencedTradeIds: flagged,
  };
}

/** Poor risk management: average loss materially larger than average win. */
function detectPoorRiskManagement(input: PatternInputs): DetectedPattern | null {
  const kpis = computeKpis(input.trades);
  if (kpis.avgWin === null || kpis.avgLoss === null || kpis.avgLoss === 0) return null;
  const ratio = Math.abs(kpis.avgWin / kpis.avgLoss);
  if (ratio >= 0.8) return null; // wins reasonably sized vs losses
  return {
    kind: 'poor_risk_management',
    summary: `Your average win (${kpis.avgWin}) is smaller than your average loss (${Math.abs(kpis.avgLoss)}). Reviewing position sizing or exits could tighten this.`,
    severity: 'attention',
    facts: [
      fact('Avg win', kpis.avgWin),
      fact('Avg loss', Math.abs(kpis.avgLoss)),
      fact('Win/loss size ratio', Number(ratio.toFixed(2))),
    ],
    referencedTradeIds: [],
  };
}

/** Rule violations sourced from 9.10 adherence (count passed in, not recomputed). */
function detectRuleViolations(input: PatternInputs): DetectedPattern | null {
  const n = input.ruleViolations ?? 0;
  if (n <= 0) return null;
  return {
    kind: 'rule_violation',
    summary: `Your playbook shows ${n} rule ${n === 1 ? 'violation' : 'violations'} in this scope. These come straight from your own checklists.`,
    severity: 'watch',
    facts: [fact('Rule violations', n)],
    referencedTradeIds: input.violationTradeIds ?? [],
  };
}

/** Best/worst conditions by session (reuses computeBreakdown; needs a sample). */
function detectConditions(input: PatternInputs): DetectedPattern[] {
  const rows = computeBreakdown(input.trades, 'session').filter((r) => r.kpis.totalTrades >= 3);
  const best = rows[0];
  const worst = rows[rows.length - 1];
  if (!best || !worst || best === worst) return [];
  const mk = (
    kind: 'best_condition' | 'worst_condition',
    label: string,
    row: (typeof rows)[number],
  ): DetectedPattern => {
    const sessionFact: SupportingFact = { label: 'Session', value: row.label, raw: null };
    return {
      kind,
      summary: `${label} session by net P&L is "${row.label}" (${row.kpis.netProfit}) over ${row.kpis.totalTrades} trades.`,
      severity: 'info',
      facts: [
        sessionFact,
        fact('Net P&L', row.kpis.netProfit),
        fact('Trades', row.kpis.totalTrades),
        fact(
          'Win rate',
          row.kpis.winRate === null ? null : Math.round(row.kpis.winRate * 100),
          '%',
        ),
      ],
      referencedTradeIds: [],
    };
  };
  const out: DetectedPattern[] = [];
  if (best.kpis.netProfit > 0) out.push(mk('best_condition', 'Strongest', best));
  if (worst.kpis.netProfit < 0) out.push(mk('worst_condition', 'Weakest', worst));
  return out;
}

/** Consecutive win/loss streaks from the KPI engine (never re-derived). */
function detectStreaks(input: PatternInputs): DetectedPattern[] {
  const kpis = computeKpis(input.trades);
  const out: DetectedPattern[] = [];
  if (kpis.maxConsecutiveWins >= 4) {
    out.push({
      kind: 'winning_streak',
      summary: `Nice consistency: a run of ${kpis.maxConsecutiveWins} winning trades in a row. Worth noting what went right.`,
      severity: 'info',
      facts: [fact('Longest win streak', kpis.maxConsecutiveWins)],
      referencedTradeIds: [],
    });
  }
  if (kpis.maxConsecutiveLosses >= 4) {
    out.push({
      kind: 'losing_streak',
      summary: `You had a stretch of ${kpis.maxConsecutiveLosses} losses in a row. Drawdowns happen to everyone — the goal is steady process, not a perfect record.`,
      severity: 'watch',
      facts: [fact('Longest loss streak', kpis.maxConsecutiveLosses)],
      referencedTradeIds: [],
    });
  }
  return out;
}

/** Run all detectors; returns patterns ordered by severity (attention first). */
export function detectPatterns(input: PatternInputs): DetectedPattern[] {
  const detected = [
    detectOvertrading(input),
    detectRevengeTrading(input),
    detectPoorRiskManagement(input),
    detectRuleViolations(input),
    ...detectConditions(input),
    ...detectStreaks(input),
  ].filter((p): p is DetectedPattern => p !== null);

  const rank: Record<DetectedPattern['severity'], number> = { attention: 0, watch: 1, info: 2 };
  return detected.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

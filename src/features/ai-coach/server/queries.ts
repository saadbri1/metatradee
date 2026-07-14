/**
 * Owner-scoped data gathering for the coach. EVERY fetch is filtered by user_id
 * (belt-and-suspenders with RLS) so a prompt can only ever contain the
 * requesting user's own data — no cross-user leakage into a model. Numbers are
 * produced by the 9.8 KPI engine here and passed to the coach as evidence; the
 * model never recomputes them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAnalyticsTrades } from '@/features/analytics/server/queries';
import { computeKpis } from '@/features/analytics';
import type { AnalyticsTrade } from '@/features/analytics';
import { fact } from '../evidence';
import type { DataSection } from '../prompts';
import type { PatternInputs } from '../patterns';
import type { ReviewScope, SupportingFact } from '../types';

export interface GatheredReview {
  scope: ReviewScope;
  targetId: string;
  title: string;
  facts: SupportingFact[];
  patternInputs: PatternInputs;
  userData: DataSection[];
  sampleSize: number;
  /** True when there is genuinely no data — the coach says so, never fabricates. */
  empty: boolean;
}

/** Inclusive [from, to] closed_at date bounds (ISO date strings) for a scope. */
function scopeRange(scope: ReviewScope, targetId: string): { from?: string; to?: string } {
  if (scope === 'trade') return {};
  if (scope === 'daily') return { from: targetId, to: targetId };
  if (scope === 'weekly') {
    const start = new Date(`${targetId}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: targetId, to: end.toISOString().slice(0, 10) };
  }
  // monthly: targetId is 'YYYY-MM'
  const parts = targetId.split('-');
  const y = Number(parts[0] ?? '1970');
  const m = Number(parts[1] ?? '1');
  const first = `${targetId}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: first, to: `${targetId}-${String(lastDay).padStart(2, '0')}` };
}

const TITLES: Record<ReviewScope, string> = {
  trade: 'Trade review',
  daily: 'Daily review',
  weekly: 'Weekly review',
  monthly: 'Monthly review',
};

/** KPI engine outputs → display facts (reconcile with Analytics by construction). */
function factsFromTrades(trades: AnalyticsTrade[]): SupportingFact[] {
  const k = computeKpis(trades);
  return [
    fact('Net P&L', k.netProfit),
    fact('Trades', k.totalTrades),
    fact('Win rate', k.winRate === null ? null : Math.round(k.winRate * 100), '%'),
    fact('Profit factor', k.profitFactor),
    fact('Avg R:R', k.avgRr),
    fact('Avg win', k.avgWin),
    fact('Avg loss', k.avgLoss === null ? null : Math.abs(k.avgLoss)),
    fact('Expectancy', k.expectancy),
    fact('Longest loss streak', k.maxConsecutiveLosses),
  ];
}

export async function gatherReview(
  supabase: SupabaseClient,
  userId: string,
  scope: ReviewScope,
  targetId: string,
): Promise<GatheredReview> {
  const title = TITLES[scope];

  // Trade set for the scope (owner-scoped).
  let trades: AnalyticsTrade[];
  if (scope === 'trade') {
    const all = await fetchAnalyticsTrades(supabase, userId, {});
    trades = all.filter((t) => t.id === targetId);
  } else {
    const { from, to } = scopeRange(scope, targetId);
    trades = await fetchAnalyticsTrades(supabase, userId, { date_from: from, date_to: to });
  }

  const tradeIds = trades.map((t) => t.id);

  // Rule violations from 9.10 adherence (COUNT ONLY — not recomputed).
  let ruleViolations = 0;
  const violationTradeIds: string[] = [];
  if (tradeIds.length > 0) {
    const { data: adh } = await supabase
      .from('trade_strategy_adherence')
      .select('trade_id, rule_violations, mistakes, lessons')
      .eq('user_id', userId)
      .in('trade_id', tradeIds);
    for (const row of (adh as
      { trade_id: string; rule_violations: string[] | null; mistakes: string[] | null }[] | null) ??
      []) {
      const count = (row.rule_violations?.length ?? 0) + (row.mistakes?.length ?? 0);
      if (count > 0) {
        ruleViolations += count;
        violationTradeIds.push(row.trade_id);
      }
    }
  }

  // Untrusted user notes for this scope (delimited + sanitized downstream).
  const userData: DataSection[] = [];
  if (tradeIds.length > 0) {
    const { data: notesRows } = await supabase
      .from('trades')
      .select('notes')
      .eq('user_id', userId)
      .in('id', tradeIds)
      .not('notes', 'is', null)
      .limit(20);
    const notes = ((notesRows as { notes: string | null }[] | null) ?? [])
      .map((r) => r.notes)
      .filter((n): n is string => !!n);
    if (notes.length) userData.push({ label: 'Trade notes', content: notes.join('\n---\n') });
  }

  const distinctDays = new Set(trades.map((t) => t.closed_at?.slice(0, 10)).filter(Boolean)).size;

  return {
    scope,
    targetId,
    title,
    facts: factsFromTrades(trades),
    patternInputs: {
      trades,
      tradingDays: distinctDays,
      ruleViolations,
      violationTradeIds,
    },
    userData,
    sampleSize: trades.length,
    empty: trades.length === 0,
  };
}

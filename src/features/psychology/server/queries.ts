/**
 * Psychology/goals/habits reads. Owner-scoped (RLS + explicit user_id). Goal
 * actuals + the emotion↔performance correlation reuse the 9.8 analytics reader +
 * KPI engine (reconcile with Analytics); habit streaks reuse the 9.11 engine.
 * The discipline score uses the single-sourced formula. Sensitive data stays
 * owner-only and private.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAnalyticsTrades } from '@/features/analytics/server/queries';
import { computeKpis } from '@/features/analytics/kpis';
import { computeHabitStreak } from '../streaks';
import { computeGoalProgress } from '../goals';
import {
  computeDisciplineScore,
  computeEmotionalStability,
  computeHabitConsistency,
  computeGoalCompletion,
} from '../scores';
import { detectDistress, type WellbeingSignal } from '../wellbeing';
import type { GoalRow, HabitLog, HabitRow, PsychologyEntry } from '../types';

function goalActual(metric: string, kpis: ReturnType<typeof computeKpis>): number | null {
  switch (metric) {
    case 'win_rate':
      return kpis.winRate === null ? null : kpis.winRate * 100;
    case 'avg_rr':
      return kpis.avgRr;
    case 'profit_target':
      return kpis.netProfit;
    case 'trading_days':
      return kpis.tradingDays;
    case 'max_trades_per_day':
      return kpis.avgTradesPerDay;
    default:
      return null; // drawdown/consistency/custom: computed elsewhere or n/a
  }
}

export interface PsychologyOverview {
  goals: (GoalRow & { actual: number | null; progressPct: number | null; achieved: boolean })[];
  habits: (HabitRow & ReturnType<typeof computeHabitStreak>)[];
  discipline: { score: number | null; components: Record<string, number | null> };
  wellbeing: WellbeingSignal;
  emotionCorrelation: { emotion: string; trades: number; winRate: number | null }[];
}

export async function getPsychologyOverview(
  supabase: SupabaseClient,
  userId: string,
): Promise<PsychologyOverview> {
  const [{ data: goalsData }, { data: habitsData }, { data: logsData }, { data: entriesData }] =
    await Promise.all([
      supabase.from('goals').select('*').eq('user_id', userId).is('deleted_at', null),
      supabase.from('habits').select('*').eq('user_id', userId).is('deleted_at', null),
      supabase
        .from('habit_logs')
        .select('habit_id, log_date, completed, is_rest_day')
        .eq('user_id', userId),
      supabase
        .from('psychology_entries')
        .select('emotion, stress, discipline, trade_id, created_at')
        .eq('user_id', userId),
    ]);

  const goalsRows = (goalsData as GoalRow[] | null) ?? [];
  const habitRows = (habitsData as HabitRow[] | null) ?? [];
  const logs = (logsData as (HabitLog & { habit_id: string })[] | null) ?? [];
  const entries =
    (entriesData as
      | (Pick<PsychologyEntry, 'emotion' | 'stress' | 'discipline' | 'trade_id'> & {
          created_at: string;
        })[]
      | null) ?? [];

  // Analytics KPIs (reused) for goal actuals.
  const trades = await fetchAnalyticsTrades(supabase, userId, {});
  const kpis = computeKpis(trades);

  const goals = goalsRows.map((g) => {
    const actual = goalActual(g.metric, kpis);
    if (actual === null) return { ...g, actual, progressPct: null, achieved: false };
    const p = computeGoalProgress(g.target_value, g.direction, actual);
    return { ...g, actual, progressPct: p.progressPct, achieved: p.achieved };
  });

  const habits = habitRows.map((h) => {
    const hlogs = logs.filter((l) => l.habit_id === h.id);
    return { ...h, ...computeHabitStreak(hlogs, { freezeTokens: h.freeze_tokens }) };
  });

  // Discipline composite (single-sourced).
  const executionInputs = entries; // execution/compliance would come from 9.10 adherence
  void executionInputs;
  const allLogs = logs.map((l) => ({ completed: l.completed, is_rest_day: l.is_rest_day }));
  const components = {
    ruleCompliance: null as number | null, // wired from 9.10 adherence in a later pass
    goalCompletion: computeGoalCompletion(goalsRows),
    habitConsistency: computeHabitConsistency(allLogs),
    executionQuality: null as number | null,
    emotionalStability: computeEmotionalStability(entries),
  };
  const discipline = computeDisciplineScore(components);

  // Emotion ↔ performance correlation (transparent, with sample sizes).
  const emotionByTrade = new Map<string, string>();
  for (const e of entries) if (e.trade_id && e.emotion) emotionByTrade.set(e.trade_id, e.emotion);
  const emotionGroups = new Map<string, typeof trades>();
  for (const t of trades) {
    const emo = emotionByTrade.get(t.id);
    if (!emo) continue;
    const arr = emotionGroups.get(emo);
    if (arr) arr.push(t);
    else emotionGroups.set(emo, [t]);
  }
  const emotionCorrelation = [...emotionGroups.entries()].map(([emotion, group]) => {
    const k = computeKpis(group);
    return { emotion, trades: k.totalTrades, winRate: k.winRate };
  });

  return {
    goals,
    habits,
    discipline: { score: discipline.score, components },
    wellbeing: detectDistress({
      recentNets: trades.slice(-5).map((t) => t.net_pnl ?? 0),
      recentEntryTimes: entries.slice(-5).map((e) => e.created_at),
      recentStress: entries.map((e) => e.stress).filter((s): s is number => s !== null),
    }),
    emotionCorrelation,
  };
}

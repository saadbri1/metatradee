/**
 * Dashboard aggregation query (Phase 10.0). The THIN dashboard-data layer the
 * spec calls for: it REUSES the 9.8 analytics engine (`fetchAnalyticsTrades` +
 * `computeKpis` + `computeEquityCurve`) and the 9.6 journal reader — it defines
 * no financial formulas and duplicates no domain logic. Every fetch is
 * owner-scoped (user_id + RLS). No fabricated rows: absent data yields honest
 * zero/empty values.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAnalyticsTrades } from '@/features/analytics/server/queries';
import { computeKpis, computeEquityCurve } from '@/features/analytics';
import type { EquityPoint, Kpis } from '@/features/analytics';
import { listTrades } from '@/features/journal/server/queries';
import type { TradeRow } from '@/features/journal/types';
import { currentStreak } from '../kpi';
import { toActivityItems, type ActivityItem, type RawAuditRow } from '../activity';
import { buildChecklist, type ChecklistItem, type ChecklistState } from '../checklist';

export interface DashboardData {
  kpis: Kpis;
  streak: { count: number; kind: 'win' | 'loss' | 'none' };
  equity: EquityPoint[];
  recentTrades: TradeRow[];
  activity: ActivityItem[];
  checklist: ChecklistItem[];
  hasAnyTrades: boolean;
}

async function count(supabase: SupabaseClient, table: string, userId: string): Promise<number> {
  const { count: n } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null);
  return n ?? 0;
}

export async function getDashboardData(
  supabase: SupabaseClient,
  userId: string,
  profile: { onboarding_completed: boolean; hasProfileBasics: boolean },
): Promise<DashboardData> {
  // Analytics engine (reused) over the owner's trades.
  const trades = await fetchAnalyticsTrades(supabase, userId, {});
  const kpis = computeKpis(trades);
  const equity = computeEquityCurve(trades);
  const streak = currentStreak(trades.map((t) => t.net_pnl));

  // Recent trades via the journal reader (owner-scoped).
  const page = await listTrades(supabase, userId, { limit: 5 });

  // Recent activity from the existing audit trail (owner-read RLS).
  const { data: auditRows } = await supabase
    .from('audit_logs')
    .select('event_type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);
  const activity = toActivityItems((auditRows as RawAuditRow[] | null) ?? []);

  // Setup checklist from real counts.
  const [accountCount, strategyCount] = await Promise.all([
    count(supabase, 'trading_accounts', userId),
    count(supabase, 'strategies', userId),
  ]);
  const checklistState: ChecklistState = {
    profileComplete: profile.hasProfileBasics,
    onboardingComplete: profile.onboarding_completed,
    accountCount,
    strategyCount,
    tradeCount: kpis.totalTrades,
  };

  return {
    kpis,
    streak,
    equity,
    recentTrades: page.items,
    activity,
    checklist: buildChecklist(checklistState),
    hasAnyTrades: kpis.totalTrades > 0,
  };
}

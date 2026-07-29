'use server';

/**
 * Analytics server actions. Pure engine + owner-scoped reads; results are cached
 * client-side (TanStack) and invalidated when trades change (9.6/9.7). Returns
 * export-ready DTOs (the export seam consumes these unchanged).
 */
import { createClient } from '@/lib/supabase/server';
import { assertFeature, type EntitlementDenial } from '@/features/billing/server/enforce';
import { getProfile } from '@/features/workspace/server/queries';
import { computeKpis } from '../kpis';
import type { TradeFilters } from '@/features/journal/filters';
import { fetchAnalyticsAccounts, fetchAnalyticsTagRows, fetchAnalyticsTrades } from './queries';
import {
  computeAnalyticsSummary,
  computeBreakdown,
  type AnalyticsSummary,
  type AnalyticsWorkspaceData,
  type BreakdownDimension,
  type BreakdownRow,
} from '../index';

export interface AnalyticsResult {
  summary: AnalyticsSummary | null;
  breakdown: BreakdownRow[];
  /**
   * Typed 403 when the plan does not include advanced analytics. The payload is
   * empty either way, so no data leaks; this lets the caller tell "not entitled"
   * apart from "no trades yet" and show an upgrade path instead of an empty
   * state that looks like a bug.
   */
  denied?: EntitlementDenial;
}

export async function getAnalyticsAction(
  filters: TradeFilters = {},
  dimension: BreakdownDimension = 'symbol',
): Promise<AnalyticsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { summary: null, breakdown: [] };

  // The /analytics PAGE is guarded, but a server action is directly invocable
  // and was returning the full advanced-analytics payload to any signed-in
  // caller. Hiding the page was never the control.
  const gate = await assertFeature(supabase, user.id, 'advancedAnalytics');
  if (!gate.ok) return { summary: null, breakdown: [], denied: gate.denial! };

  const trades = await fetchAnalyticsTrades(supabase, user.id, filters);
  return {
    summary: computeAnalyticsSummary(trades),
    breakdown: computeBreakdown(trades, dimension),
  };
}

// Dimensions every workspace tab needs, computed once per fetch so a tab change
// never re-requests the full history.
const WORKSPACE_DIMENSIONS: BreakdownDimension[] = [
  'symbol',
  'setup',
  'strategy',
  'direction',
  'source',
  'dayOfWeek',
  'hourOfDay',
  'month',
];

export async function getAnalyticsWorkspaceAction(
  filters: TradeFilters = {},
): Promise<AnalyticsWorkspaceData> {
  const empty: AnalyticsWorkspaceData = {
    summary: null,
    breakdowns: {},
    accounts: [],
    tags: [],
    timezone: 'UTC',
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  // Same gate as the page. A directly-invoked server action must not return the
  // advanced-analytics payload to a plan that does not include it.
  const gate = await assertFeature(supabase, user.id, 'advancedAnalytics');
  if (!gate.ok) return { ...empty, denied: gate.denial! };

  const [trades, accountsMeta, profile] = await Promise.all([
    fetchAnalyticsTrades(supabase, user.id, filters),
    fetchAnalyticsAccounts(supabase, user.id),
    getProfile(),
  ]);

  const breakdowns: AnalyticsWorkspaceData['breakdowns'] = {};
  for (const dim of WORKSPACE_DIMENSIONS) breakdowns[dim] = computeBreakdown(trades, dim);

  // Per-account KPIs joined to real account metadata (no invented balances).
  const byAccount = new Map(computeBreakdown(trades, 'account').map((r) => [r.key, r.kpis]));
  const accounts = accountsMeta
    .map((meta) => ({
      ...meta,
      kpis: byAccount.get(meta.id) ?? computeKpis([]),
    }))
    .sort((a, b) => b.kpis.netProfit - a.kpis.netProfit);

  const tags = await fetchAnalyticsTagRows(supabase, user.id, trades);

  return {
    summary: computeAnalyticsSummary(trades),
    breakdowns,
    accounts,
    tags,
    timezone: profile?.timezone || 'UTC',
  };
}

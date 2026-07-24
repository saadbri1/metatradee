'use server';

/**
 * Analytics server actions. Pure engine + owner-scoped reads; results are cached
 * client-side (TanStack) and invalidated when trades change (9.6/9.7). Returns
 * export-ready DTOs (the export seam consumes these unchanged).
 */
import { createClient } from '@/lib/supabase/server';
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

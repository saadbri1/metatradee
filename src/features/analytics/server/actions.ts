'use server';

/**
 * Analytics server actions. Pure engine + owner-scoped reads; results are cached
 * client-side (TanStack) and invalidated when trades change (9.6/9.7). Returns
 * export-ready DTOs (the export seam consumes these unchanged).
 */
import { createClient } from '@/lib/supabase/server';
import type { TradeFilters } from '@/features/journal/filters';
import { fetchAnalyticsTrades } from './queries';
import {
  computeAnalyticsSummary,
  computeBreakdown,
  type AnalyticsSummary,
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

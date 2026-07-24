'use client';

import { useQuery } from '@tanstack/react-query';
import type { TradeFilters } from '@/features/journal/filters';
import { getAnalyticsAction, getAnalyticsWorkspaceAction } from './server/actions';
import type { BreakdownDimension } from './types';

/** Analytics query key root — journal/import mutations invalidate this. */
export const ANALYTICS_QUERY_KEY = ['analytics'] as const;

export function useAnalytics(filters: TradeFilters, dimension: BreakdownDimension) {
  return useQuery({
    queryKey: [...ANALYTICS_QUERY_KEY, filters, dimension],
    queryFn: () => getAnalyticsAction(filters, dimension),
    staleTime: 60_000,
  });
}

/**
 * The full Analytics workspace payload for the current filters — one fetch feeds
 * every tab, so switching tabs never re-requests the history.
 */
export function useAnalyticsWorkspace(filters: TradeFilters) {
  return useQuery({
    queryKey: [...ANALYTICS_QUERY_KEY, 'workspace', filters],
    queryFn: () => getAnalyticsWorkspaceAction(filters),
    staleTime: 60_000,
  });
}

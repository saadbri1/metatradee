'use client';

import { useQuery } from '@tanstack/react-query';
import type { TradeFilters } from '@/features/journal/filters';
import { getCalendarAction } from './server/actions';

/** Shares the 'analytics' key root so trade changes invalidate the calendar too. */
export const CALENDAR_QUERY_KEY = ['analytics', 'calendar'] as const;

export function useCalendar(filters: TradeFilters) {
  return useQuery({
    queryKey: [...CALENDAR_QUERY_KEY, filters],
    queryFn: () => getCalendarAction(filters),
    staleTime: 60_000,
  });
}

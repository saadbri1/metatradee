'use server';

/**
 * Calendar server action. Reuses the analytics owner-scoped reader + the pure
 * calendar engine; results are cached client-side (TanStack) and invalidated
 * when trades change (shared 'analytics' key). Returns the tz actually used.
 */
import { createClient } from '@/lib/supabase/server';
import type { TradeFilters } from '@/features/journal/filters';
import { fetchAnalyticsTrades } from '@/features/analytics/server/queries';
import { buildCalendarSummary, type CalendarSummary } from '../index';
import { getUserTimezone } from './queries';

export interface CalendarResult {
  summary: CalendarSummary | null;
  timezone: string;
}

export async function getCalendarAction(
  filters: TradeFilters = {},
  tzOverride?: string,
): Promise<CalendarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { summary: null, timezone: 'UTC' };

  const timezone = tzOverride ?? (await getUserTimezone(supabase, user.id));
  const trades = await fetchAnalyticsTrades(supabase, user.id, filters);
  return { summary: buildCalendarSummary(trades, timezone), timezone };
}

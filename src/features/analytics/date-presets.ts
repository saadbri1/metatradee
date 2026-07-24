/** Deterministic date-range presets for the Analytics filters (pure). */
import type { TradeFilters } from '@/features/journal/filters';

export type DatePreset =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'previous_month'
  | 'last_30'
  | 'last_90'
  | 'ytd'
  | 'custom';

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'custom', label: 'Custom range' },
];

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Resolve a preset to an ISO {from,to} range using `now` (UTC boundaries). */
export function presetRange(preset: DatePreset, now = new Date()): { from?: string; to?: string } {
  const today = startOfDay(now);
  const iso = (d: Date) => d.toISOString();
  switch (preset) {
    case 'today':
      return { from: iso(today) };
    case 'this_week': {
      const day = today.getUTCDay();
      const monday = new Date(today);
      monday.setUTCDate(today.getUTCDate() - ((day + 6) % 7));
      return { from: iso(monday) };
    }
    case 'this_month':
      return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))) };
    case 'previous_month':
      return {
        from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))),
        to: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
      };
    case 'last_30':
      return { from: iso(new Date(today.getTime() - 30 * 86400_000)) };
    case 'last_90':
      return { from: iso(new Date(today.getTime() - 90 * 86400_000)) };
    case 'ytd':
      return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) };
    case 'all':
    case 'custom':
    default:
      return {};
  }
}

/** Infer which preset a filter's date range matches (for the selector value). */
export function inferPreset(filters: TradeFilters, now = new Date()): DatePreset {
  if (!filters.date_from && !filters.date_to) return 'all';
  for (const { value } of DATE_PRESETS) {
    if (value === 'all' || value === 'custom') continue;
    const r = presetRange(value, now);
    if ((r.from ?? undefined) === filters.date_from && (r.to ?? undefined) === filters.date_to) {
      return value;
    }
  }
  return 'custom';
}

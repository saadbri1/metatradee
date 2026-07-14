/**
 * Calendar reads. Trade rows are fetched via the SAME owner-scoped analytics
 * reader (excludes soft-deleted/archived) so calendar reconciles with analytics
 * exactly. The user's timezone (critical for bucketing) is resolved from
 * user_preferences server-side.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getUserTimezone(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  const tz = (data as { timezone?: string } | null)?.timezone;
  return tz && tz.length > 0 ? tz : 'UTC';
}

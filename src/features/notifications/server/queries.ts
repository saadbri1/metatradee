/**
 * Notification reads/mutations. Owner-scoped: every query filters by user_id
 * (belt-and-suspenders with the RLS owner policies). Clients cannot INSERT —
 * the table has no insert policy, so notifications are created server-side only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationRow } from '../types';

const COLUMNS = 'id, type, title, body, link, metadata, read_at, dismissed_at, created_at';

/** A user's active (non-dismissed) notifications, newest first. */
export async function listNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200));
  return (data as NotificationRow[] | null) ?? [];
}

/** Unread badge count (uses the partial index on unread rows). */
export async function countUnread(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
    .is('dismissed_at', null);
  return count ?? 0;
}

/** Mark one notification read (owner-scoped; RLS also enforces ownership). */
export async function markRead(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('read_at', null);
  return !error;
}

/** Mark every unread notification read. */
export async function markAllRead(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  return !error;
}

/** Dismiss (soft-hide) a notification — never destroys the row. */
export async function dismissNotification(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  return !error;
}

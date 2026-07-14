/**
 * Notification types (Phase 9.3 gap-fill). Mirrors the `notifications` table.
 * Clients may READ and mark read/dismissed only — creation is server-side
 * (the table has no client insert policy).
 */
export type NotificationType = 'system' | 'trade' | 'report' | 'billing' | 'ai' | 'reminder';

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** Internal deep-link (e.g. `/journal/<id>`); never an external URL. */
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

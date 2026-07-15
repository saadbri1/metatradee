/**
 * Recent-activity presentation (Phase 10.0). Maps the EXISTING audit_logs
 * event_type (9.2 `AUDIT_EVENTS`) to a friendly label — it reuses that trail,
 * never a second logging system. Unknown/unmapped events render with a safe
 * generic label rather than being dropped or faked.
 */
export interface RawAuditRow {
  event_type: string;
  created_at: string;
}

export interface ActivityItem {
  label: string;
  at: string;
}

const LABELS: Record<string, string> = {
  'auth.registered': 'Account created',
  'auth.login.succeeded': 'Signed in',
  'profile.updated': 'Profile updated',
  'profile.username.changed': 'Username changed',
  'profile.avatar.changed': 'Avatar changed',
  'profile.onboarding.completed': 'Completed onboarding',
  'trade.created': 'Logged a trade',
  'trade.deleted': 'Deleted a trade',
  'strategy.created': 'Created a strategy',
  'strategy.updated': 'Updated a strategy',
  'mfa.enrolled': 'Enabled two-factor authentication',
  'mfa.unenrolled': 'Disabled two-factor authentication',
};

/** Human-facing label for an audit event (safe fallback for unmapped types). */
export function activityLabel(eventType: string): string {
  if (LABELS[eventType]) return LABELS[eventType];
  // Derive a readable fallback from the slug, e.g. "report.share.created".
  const tail = eventType.split('.').slice(-2).join(' ').replace(/_/g, ' ');
  return tail ? `${tail.charAt(0).toUpperCase()}${tail.slice(1)}` : 'Activity';
}

export function toActivityItems(rows: RawAuditRow[]): ActivityItem[] {
  return rows.map((r) => ({ label: activityLabel(r.event_type), at: r.created_at }));
}

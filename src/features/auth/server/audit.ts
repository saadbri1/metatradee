/**
 * Audit-logging hook. Writes security events through the security-definer
 * `log_audit_event` RPC (the only write path into audit_logs). Audit failures
 * must NEVER break an auth flow, so every call is best-effort and swallowed.
 */
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { AuditEvent } from '../config';

/** Best-effort extraction of client IP + user-agent from request headers. */
async function requestContext(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    const ip = forwarded ? (forwarded.split(',')[0]?.trim() ?? null) : null;
    return { ip, ua: h.get('user-agent') };
  } catch {
    return { ip: null, ua: null };
  }
}

/**
 * Record a security event. `metadata` must not contain secrets or full PII —
 * only what's needed to investigate (e.g. a coarse email for failed logins).
 */
export async function logAuditEvent(
  event: AuditEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createClient();
    const { ip, ua } = await requestContext();
    await supabase.rpc('log_audit_event', {
      p_event_type: event,
      p_metadata: metadata,
      p_ip: ip,
      p_user_agent: ua,
    });
  } catch {
    // Intentionally swallowed — auditing is never allowed to fail an auth flow.
  }
}

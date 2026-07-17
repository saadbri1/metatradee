/**
 * Outbound webhook payloads + signing (Phase 11.2). Pure + tested.
 *
 * MINIMAL, NON-SENSITIVE payloads: an event carries only ids + type +
 * timestamp — never psychology content, trade notes, secrets, or card data.
 * Receivers fetch detail via the API (with their own scoped token). Signing
 * mirrors the 10.7/Stripe scheme (`t=<unix>,v1=<hmac>` over `${t}.${body}`) so
 * receivers can verify authenticity + guard replay via the timestamp.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_EVENTS = [
  'trade.created',
  'trade.updated',
  'trade.deleted',
  'report.generated',
  'subscription.changed',
  'workspace.member.joined',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookPayload {
  id: string; // delivery id
  type: WebhookEvent;
  createdAt: string; // ISO
  data: { id: string; workspaceId?: string }; // IDs ONLY — never content
}

/** Keys that must never appear in a webhook payload (defense-in-depth check). */
const FORBIDDEN_KEYS =
  /note|notes|psychology|emotion|stress|discipline|secret|token|password|card|pan|cvv|hash|payload/i;

/** Build a minimal payload; strips any accidental sensitive field. */
export function buildWebhookPayload(
  deliveryId: string,
  type: WebhookEvent,
  data: { id: string; workspaceId?: string },
  now: Date = new Date(),
): WebhookPayload {
  return {
    id: deliveryId,
    type,
    createdAt: now.toISOString(),
    data: { id: data.id, ...(data.workspaceId ? { workspaceId: data.workspaceId } : {}) },
  };
}

/** True if a payload accidentally contains a sensitive key anywhere. */
export function payloadIsClean(payload: unknown): boolean {
  return !FORBIDDEN_KEYS.test(JSON.stringify(payload));
}

export function signWebhook(body: string, secret: string, timestamp: number): string {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

/** Receiver-side verify (also used in tests). Constant-time + replay window. */
export function verifyWebhook(
  body: string,
  header: string,
  secret: string,
  toleranceSec = 300,
  now: number = Math.floor(Date.now() / 1000),
): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!parts.v1 || Number.isNaN(t) || Math.abs(now - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const a = Buffer.from(parts.v1, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Exponential backoff schedule for delivery retries (seconds). */
export const RETRY_BACKOFF_SEC = [30, 120, 600, 3600, 21600] as const;
/** After this many consecutive failures the endpoint auto-disables. */
export const MAX_CONSECUTIVE_FAILURES = 15;

export function nextRetryDelay(attempt: number): number | null {
  if (attempt >= RETRY_BACKOFF_SEC.length) return null; // → dead-letter
  return RETRY_BACKOFF_SEC[attempt] ?? null;
}
export function shouldAutoDisable(consecutiveFailures: number): boolean {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
}

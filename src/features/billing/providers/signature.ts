/**
 * Webhook signature verification (server-side only; node:crypto). Mirrors
 * Stripe's scheme: header `t=<unix>,v1=<hex-hmac>` where the HMAC-SHA256 is over
 * `${t}.${rawBody}` keyed by the endpoint's signing secret. Verification is
 * constant-time and enforces a timestamp tolerance to blunt replay. An unsigned
 * or mismatched event is REJECTED (no side effects) — never trusted.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignatureParts {
  timestamp: number;
  signatures: string[];
}

/** Parse a `t=...,v1=...,v1=...` signature header. */
export function parseSignatureHeader(header: string): SignatureParts | null {
  const parts = header.split(',').map((p) => p.trim());
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't' && value) timestamp = Number(value);
    else if (key === 'v1' && value) signatures.push(value);
  }
  if (timestamp === null || Number.isNaN(timestamp) || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export function computeSignature(payload: string, timestamp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Verify a webhook signature. Returns true only when a provided v1 signature
 * matches AND the timestamp is within `toleranceSec` of now.
 */
export function verifyWebhookSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSec = 300,
  now: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  if (Math.abs(now - parsed.timestamp) > toleranceSec) return false;
  const expected = computeSignature(payload, parsed.timestamp, secret);
  return parsed.signatures.some((sig) => safeEqualHex(sig, expected));
}

/**
 * Lightweight bot protection. PURE — no clock of its own, no network, no store,
 * so every rule below is directly testable.
 *
 * Three independent signals, because each alone is weak:
 *   1. HONEYPOT   a field a human never sees and never fills
 *   2. TIMING     a form completed impossibly fast was not typed
 *   3. RATE LIMIT the same origin submitting repeatedly
 *
 * DELIBERATELY ADAPTER-FRIENDLY. `verdict()` takes a plain signal object, so
 * adding Turnstile later means adding one more signal to that object and one
 * more branch here — no change to the form, the action, or the transport.
 */

/** Minimum plausible time to read and complete the form. */
export const MIN_FILL_MS = 3_000;
/** Beyond this the token is stale — a replayed or long-parked page. */
export const MAX_FILL_MS = 2 * 60 * 60 * 1000;

export const RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 } as const;

export type BotVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'honeypot' | 'too_fast' | 'stale' | 'rate_limited' | 'duplicate' };

export interface BotSignals {
  /** Value of the hidden field. Anything non-empty is a bot. */
  honeypot: string;
  /** Epoch ms the form was rendered, from a hidden field. */
  renderedAt: number;
  /** Now, passed in so this stays pure. */
  now: number;
  /** Submissions already recorded for this origin inside the window. */
  recentSubmissions: number;
  /** True when an identical payload was already accepted recently. */
  isDuplicate: boolean;
}

export function verdict(s: BotSignals): BotVerdict {
  // A human cannot fill a field that is not rendered.
  if (s.honeypot.trim().length > 0) return { allowed: false, reason: 'honeypot' };

  const elapsed = s.now - s.renderedAt;
  /*
   * A non-finite or future timestamp is treated as too fast rather than
   * ignored: a forged hidden field must not become a way to skip the check.
   */
  if (!Number.isFinite(s.renderedAt) || elapsed < MIN_FILL_MS) {
    return { allowed: false, reason: 'too_fast' };
  }
  if (elapsed > MAX_FILL_MS) return { allowed: false, reason: 'stale' };

  if (s.isDuplicate) return { allowed: false, reason: 'duplicate' };
  if (s.recentSubmissions >= RATE_LIMIT.max) return { allowed: false, reason: 'rate_limited' };

  return { allowed: true };
}

/**
 * What the user is told. A bot gets no diagnostic — telling it WHICH signal
 * tripped is telling it how to pass next time — so honeypot and timing share
 * the generic message.
 */
export const BOT_MESSAGE: Record<Exclude<BotVerdict, { allowed: true }>['reason'], string> = {
  honeypot: 'We could not send that. Please try again.',
  too_fast: 'We could not send that. Please try again.',
  stale: 'This form has been open a while. Please reload the page and send it again.',
  rate_limited: 'You have sent several messages recently. Please try again in a few minutes.',
  duplicate: 'That message has already been sent — we have it.',
};

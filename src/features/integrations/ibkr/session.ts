import 'server-only';

/**
 * Per-token Flex session state: the pending ReferenceCode, the single-flight
 * lock, and the sliding pacing window.
 *
 * WHY THIS EXISTS: without it, every browser refresh called `/SendRequest` and
 * generated a brand-new report. That burns IBKR's request budget, throttles the
 * token, and is simply the wrong protocol — a reference code is meant to be
 * requested once and then polled.
 *
 * STORAGE SCOPE — stated plainly: this is in-process memory. On a warm instance
 * it does exactly what is required (refreshes reuse one reference and make no
 * extra IBKR calls). Across a cold start or a second concurrent serverless
 * instance, state is not shared, so a second instance could issue its own
 * SendRequest. A durable shared store is the Phase 2 fix; the sliding window
 * below is deliberately conservative so that even the worst case stays inside
 * IBKR's limits.
 *
 * The token is NEVER stored. Sessions are keyed by a salted fingerprint, so
 * this map cannot leak a credential even if it were dumped.
 */
import { createHash } from 'node:crypto';
import type { FlexErrorCategory } from './types';

/** IBKR reference codes do not stay valid forever; re-request well before. */
export const REFERENCE_TTL_MS = 15 * 60_000;

/** Pacing: at most one request per second and ten per rolling minute. */
export const MIN_REQUEST_SPACING_MS = 1_000;
export const MAX_REQUESTS_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

/** Exponential backoff for a still-generating report, before jitter. */
const BACKOFF_BASE_MS = 3_000;
const BACKOFF_MAX_MS = 60_000;
/** ±20% jitter so several clients cannot synchronise into a burst. */
const JITTER_RATIO = 0.2;

export interface PendingReference {
  referenceCode: string;
  createdAt: number;
  /** How many times we have polled this reference. Drives the backoff. */
  polls: number;
  /** No IBKR request may be made for this session before this timestamp. */
  nextEligibleAt: number;
}

interface FlexSession {
  pending: PendingReference | null;
  /** Request start times inside the rolling window. */
  window: number[];
  lastRequestAt: number;
  /** Set while a sequence is running, so only one is ever in flight. */
  inFlight: Promise<unknown> | null;
}

const sessions = new Map<string, FlexSession>();

/**
 * Salted fingerprint of a token. One-way and never reversible to the
 * credential; used only as a map key.
 */
export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(`metatradee-flex:${token}`).digest('hex').slice(0, 32);
}

function session(key: string): FlexSession {
  let existing = sessions.get(key);
  if (!existing) {
    existing = { pending: null, window: [], lastRequestAt: 0, inFlight: null };
    sessions.set(key, existing);
  }
  return existing;
}

/** Test-only: clear all session state. */
export function __resetSessions(): void {
  sessions.clear();
}

// ---------------------------------------------------------------------------
// Pending reference
// ---------------------------------------------------------------------------

/** The live pending reference for this token, or null when there is none. */
export function getPending(key: string, now: number): PendingReference | null {
  const state = session(key);
  if (!state.pending) return null;
  if (now - state.pending.createdAt > REFERENCE_TTL_MS) {
    // Expired: a new report may be generated.
    state.pending = null;
    return null;
  }
  return state.pending;
}

export function setPending(key: string, referenceCode: string, now: number): PendingReference {
  const pending: PendingReference = {
    referenceCode,
    createdAt: now,
    polls: 0,
    nextEligibleAt: now,
  };
  session(key).pending = pending;
  return pending;
}

/** Drop the reference — the report succeeded, or failed terminally. */
export function clearPending(key: string): void {
  session(key).pending = null;
}

/**
 * Record a poll that came back pending and schedule the next eligible moment
 * with exponential backoff plus jitter.
 */
export function backoffPending(
  key: string,
  now: number,
  random: () => number = Math.random,
): PendingReference | null {
  const state = session(key);
  if (!state.pending) return null;

  state.pending.polls += 1;
  const exponential = Math.min(BACKOFF_BASE_MS * 2 ** (state.pending.polls - 1), BACKOFF_MAX_MS);
  // Symmetric ±JITTER_RATIO around the exponential delay.
  const jitter = exponential * JITTER_RATIO * (random() * 2 - 1);
  state.pending.nextEligibleAt = now + Math.max(BACKOFF_BASE_MS, Math.round(exponential + jitter));
  return state.pending;
}

// ---------------------------------------------------------------------------
// Pacing
// ---------------------------------------------------------------------------

export type SlotReservation =
  | { allowed: true; waitMs: number }
  | {
      allowed: false;
      retryAfterSeconds: number;
      category: Extract<FlexErrorCategory, 'pacing_limit'>;
    };

/**
 * Atomically reserve the next request slot.
 *
 * Deliberately reserve-then-wait rather than check-then-act. An earlier version
 * checked the clock, slept, then re-checked — which refuses forever if the
 * clock has not advanced, and races if two callers check before either records.
 * Here the slot is claimed at `now + waitMs` in one step, so the caller simply
 * sleeps out `waitMs` and proceeds.
 *
 * The per-minute ceiling REFUSES rather than waiting: a request handler must
 * never block for tens of seconds. It reports how long to wait instead.
 */
export function reserveSlot(key: string, now: number): SlotReservation {
  const state = session(key);
  state.window = state.window.filter((t) => now - t < WINDOW_MS);

  if (state.window.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldest = state.window[0]!;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1_000)),
      category: 'pacing_limit',
    };
  }

  const sinceLast = now - state.lastRequestAt;
  const waitMs =
    state.lastRequestAt > 0 && sinceLast < MIN_REQUEST_SPACING_MS
      ? MIN_REQUEST_SPACING_MS - sinceLast
      : 0;

  const at = now + waitMs;
  state.lastRequestAt = at;
  state.window.push(at);
  return { allowed: true, waitMs };
}

/** Requests remaining in the current rolling minute (diagnostics only). */
export function requestsRemaining(key: string, now: number): number {
  const state = session(key);
  state.window = state.window.filter((t) => now - t < WINDOW_MS);
  return Math.max(0, MAX_REQUESTS_PER_MINUTE - state.window.length);
}

// ---------------------------------------------------------------------------
// Single flight
// ---------------------------------------------------------------------------

/**
 * Run `task` for this token, guaranteeing only ONE sequence is in flight.
 *
 * A concurrent caller does not queue a second IBKR sequence — it awaits the one
 * already running and shares its result. Two browser tabs refreshing together
 * therefore cost one set of IBKR requests, not two.
 */
export async function withSingleFlight<T>(key: string, task: () => Promise<T>): Promise<T> {
  const state = session(key);
  if (state.inFlight) return state.inFlight as Promise<T>;

  const run = task().finally(() => {
    state.inFlight = null;
  });
  state.inFlight = run;
  return run;
}

/** True when a sequence is already running for this token. */
export function isInFlight(key: string): boolean {
  return session(key).inFlight !== null;
}

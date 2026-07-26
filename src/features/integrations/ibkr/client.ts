import 'server-only';

/**
 * Server-only Interactive Brokers Flex Web Service client.
 *
 * This is the ONLY module that talks to IBKR. Everything above it receives
 * vendor-free values (`FlexReport`, `FlexError`), so the provider can be
 * swapped without touching domain code.
 *
 * SECRET HANDLING
 * - The token and query id arrive as arguments from a `FlexCredentialSource`;
 *   this module reads no environment variable.
 * - IBKR only accepts them as query parameters, so the URL itself is sensitive.
 *   It is built at the moment of the request, never logged, never returned, and
 *   never attached to an error. Only the endpoint NAME is ever surfaced.
 * - Every failure is normalised to a `FlexError` category before it escapes.
 *
 * PACING lives in `session.ts`, keyed by a token fingerprint, so the limit is
 * enforced token-wide across every code path rather than per call site. This
 * module asks permission before each request and records it.
 */
import { FlexError, type FlexCredentials, type FlexReport } from './types';
import { parseSendRequest, parseStatement } from './parse';
import { reserveSlot } from './session';

const BASE_URL = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService';
const API_VERSION = '3';

/** Wall-clock budget for a single HTTP call. */
const REQUEST_TIMEOUT_MS = 15_000;

export interface FlexClientDeps {
  /** Injected so tests never touch the network. */
  fetchImpl?: typeof fetch;
  /** Injected so tests do not spend real time waiting. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  /** Injected so jittered backoff is deterministic under test. */
  random?: () => number;
}

export type ResolvedDeps = Required<FlexClientDeps>;

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new FlexError('network'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new FlexError('network'));
      },
      { once: true },
    );
  });
}

export function resolveDeps(deps: FlexClientDeps = {}): ResolvedDeps {
  return {
    fetchImpl: deps.fetchImpl ?? fetch,
    sleep: deps.sleep ?? defaultSleep,
    now: deps.now ?? Date.now,
    random: deps.random ?? Math.random,
  };
}

/**
 * A pacing refusal carrying the wait the caller should report.
 *
 * `pacing_limit` is NEVER retried automatically — retrying into a throttle is
 * what gets a token blocked. It is surfaced with a wait instead.
 */
export class FlexPacingError extends FlexError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('pacing_limit', false);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Perform one Flex call and return the raw body.
 *
 * Honours the token-wide sliding window: at most one request per second and ten
 * per rolling minute. A sub-second gap is waited out (bounded, ≤1s); a full
 * per-minute window refuses immediately rather than blocking the handler.
 */
async function callFlex(
  endpoint: 'SendRequest' | 'GetStatement',
  params: Record<string, string>,
  sessionKey: string,
  deps: ResolvedDeps,
  signal?: AbortSignal,
): Promise<string> {
  // Reserve atomically, then wait out whatever spacing the reservation implies.
  const slot = reserveSlot(sessionKey, deps.now());
  if (!slot.allowed) throw new FlexPacingError(slot.retryAfterSeconds);
  if (slot.waitMs > 0) await deps.sleep(slot.waitMs, signal);

  const url = new URL(`${BASE_URL}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('v', API_VERSION);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await deps.fetchImpl(url.toString(), {
      method: 'GET',
      headers: { accept: 'text/xml' },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (response.status === 429) throw new FlexPacingError(30);
    if (response.status >= 500) throw new FlexError('ibkr_unavailable', true);
    if (!response.ok) throw new FlexError('ibkr_unavailable', false);

    return await response.text();
  } catch (error) {
    // Never re-wrap our own categorised errors, and never let a transport error
    // carry a URL or provider text outward.
    if (error instanceof FlexError) throw error;
    throw new FlexError('network', true);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Step 1 — ask IBKR to generate the saved query. Returns its reference code. */
export async function sendFlexRequest(
  credentials: FlexCredentials,
  sessionKey: string,
  deps: ResolvedDeps,
  signal?: AbortSignal,
): Promise<{ referenceCode: string }> {
  const xml = await callFlex(
    'SendRequest',
    { t: credentials.token, q: credentials.queryId },
    sessionKey,
    deps,
    signal,
  );
  return parseSendRequest(xml);
}

/** Step 2 — retrieve the generated statement for an existing reference code. */
export async function getFlexStatement(
  credentials: FlexCredentials,
  referenceCode: string,
  sessionKey: string,
  deps: ResolvedDeps,
  signal?: AbortSignal,
): Promise<FlexReport> {
  const xml = await callFlex(
    'GetStatement',
    { t: credentials.token, q: referenceCode },
    sessionKey,
    deps,
    signal,
  );
  return parseStatement(xml);
}

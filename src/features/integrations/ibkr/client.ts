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
 * - IBKR's API only accepts them as query parameters, so the URL itself is
 *   sensitive. It is therefore built at the moment of the request, never
 *   logged, never returned, and never attached to an error. Only the endpoint
 *   NAME ("SendRequest" / "GetStatement") is ever surfaced.
 * - Every failure is normalised to a `FlexError` category before it escapes.
 *
 * PACING — IBKR limits Flex requests, and exceeding it gets a token throttled:
 * at most one request per second and ten per minute, enforced in-process
 * before any call. Retries are BOUNDED and delayed; nothing here polls
 * continuously.
 */
import { FlexError, type FlexCredentials, type FlexReport } from './types';
import { parseSendRequest, parseStatement } from './parse';

const BASE_URL = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService';
const API_VERSION = '3';

/** Wall-clock budget for a single HTTP call. */
const REQUEST_TIMEOUT_MS = 15_000;

/** IBKR pacing: ≥1s between requests, ≤10 in any rolling minute. */
const MIN_REQUEST_SPACING_MS = 1_000;
const MAX_REQUESTS_PER_MINUTE = 10;

/**
 * Retry budget for "report not ready". Deliberately small: a Flex report that
 * is not ready after a few spaced attempts should be reported as pending so the
 * caller can come back, not waited on inside a request.
 */
export const MAX_STATEMENT_ATTEMPTS = 4;
const RETRY_DELAY_MS = 2_000;

/** Rolling window of request start times, for the per-minute ceiling. */
let requestTimestamps: number[] = [];
let lastRequestAt = 0;

/** Test-only: reset the in-process pacing state between cases. */
export function __resetPacing(): void {
  requestTimestamps = [];
  lastRequestAt = 0;
}

export interface FlexClientDeps {
  /** Injected so tests never touch the network. */
  fetchImpl?: typeof fetch;
  /** Injected so tests do not spend real time waiting. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
}

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

/**
 * Block until making a request would respect both pacing limits. Refuses
 * rather than sleeping for a long time when the per-minute ceiling is hit, so
 * a request handler can never hang on a full window.
 */
async function awaitPacingSlot(
  deps: Required<Pick<FlexClientDeps, 'sleep' | 'now'>>,
  signal?: AbortSignal,
): Promise<void> {
  const now = deps.now();
  requestTimestamps = requestTimestamps.filter((t) => now - t < 60_000);

  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    throw new FlexError('pacing_limit', true);
  }

  const sinceLast = now - lastRequestAt;
  if (lastRequestAt > 0 && sinceLast < MIN_REQUEST_SPACING_MS) {
    await deps.sleep(MIN_REQUEST_SPACING_MS - sinceLast, signal);
  }

  const stamp = deps.now();
  lastRequestAt = stamp;
  requestTimestamps.push(stamp);
}

/**
 * Perform one Flex call and return the raw body.
 *
 * `endpoint` is the only identifier allowed into an error or a log line; the
 * built URL carries the token and never leaves this function.
 */
async function callFlex(
  endpoint: 'SendRequest' | 'GetStatement',
  params: Record<string, string>,
  deps: Required<FlexClientDeps>,
  signal?: AbortSignal,
): Promise<string> {
  await awaitPacingSlot(deps, signal);

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

    if (response.status === 429) throw new FlexError('pacing_limit', true);
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
  deps: Required<FlexClientDeps>,
  signal?: AbortSignal,
): Promise<{ referenceCode: string }> {
  const xml = await callFlex(
    'SendRequest',
    { t: credentials.token, q: credentials.queryId },
    deps,
    signal,
  );
  return parseSendRequest(xml);
}

/** Step 2 — retrieve the generated statement for a reference code. */
export async function getFlexStatement(
  credentials: FlexCredentials,
  referenceCode: string,
  deps: Required<FlexClientDeps>,
  signal?: AbortSignal,
): Promise<FlexReport> {
  const xml = await callFlex(
    'GetStatement',
    { t: credentials.token, q: referenceCode },
    deps,
    signal,
  );
  return parseStatement(xml);
}

export function resolveDeps(deps: FlexClientDeps = {}): Required<FlexClientDeps> {
  return {
    fetchImpl: deps.fetchImpl ?? fetch,
    sleep: deps.sleep ?? defaultSleep,
    now: deps.now ?? Date.now,
  };
}

/**
 * Generate and retrieve the saved query in one bounded operation.
 *
 * A freshly requested report is normally not ready on the first read, so
 * `report_pending` is retried a small, fixed number of times with a delay
 * between attempts. Every other category fails immediately — retrying an
 * expired token would only burn pacing budget. Exhausting the budget surfaces
 * `report_pending`, which is the truth: the report exists and is still building.
 */
export async function fetchFlexReport(
  credentials: FlexCredentials,
  options: FlexClientDeps & { signal?: AbortSignal; maxAttempts?: number } = {},
): Promise<FlexReport> {
  const deps = resolveDeps(options);
  const maxAttempts = options.maxAttempts ?? MAX_STATEMENT_ATTEMPTS;
  const { referenceCode } = await sendFlexRequest(credentials, deps, options.signal);

  let lastPending: FlexError = new FlexError('report_pending', true);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await deps.sleep(RETRY_DELAY_MS, options.signal);
    try {
      return await getFlexStatement(credentials, referenceCode, deps, options.signal);
    } catch (error) {
      if (error instanceof FlexError && error.category === 'report_pending') {
        lastPending = error;
        continue;
      }
      throw error;
    }
  }
  throw lastPending;
}

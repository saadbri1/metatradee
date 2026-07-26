import 'server-only';

/**
 * Phase 1 verification: can MetaTradee generate, retrieve and parse the saved
 * "MetaTradee Activity" Flex query?
 *
 * POLLING PROTOCOL
 *
 * A Flex report is requested ONCE and then polled, so:
 *   1. A live pending session is loaded from DURABLE storage. If one exists,
 *      only `/GetStatement` runs, with the persisted ReferenceCode. This
 *      survives cold starts and is shared across serverless instances.
 *   2. `/SendRequest` runs only when no live session exists.
 *   3. Every outcome — including "IBKR answered SendRequest with pending" —
 *      writes a session with a backoff. THIS WAS THE BUG: previously a session
 *      was stored only after a ReferenceCode was obtained, so a pending answer
 *      on the SendRequest leg left nothing to reuse and every request re-issued
 *      SendRequest, producing a byte-identical response forever.
 *   4. A refresh landing inside the backoff makes NO provider request at all.
 *   5. A session that never completes inside its TTL becomes `report_timeout`
 *      instead of pending forever.
 *   6. `pacing_limit` is never retried automatically.
 *
 * This module owns the SAFE PROJECTION: every field is built explicitly, so no
 * provider value can leak. The ReferenceCode is used but NEVER returned.
 * NOTHING IS PERSISTED from the report itself — trades are counted and dropped.
 */
import { envFlexCredentialSource, type FlexCredentialSource } from './credentials';
import {
  getFlexStatement,
  resolveDeps,
  sendFlexRequest,
  FlexPacingError,
  type FlexClientDeps,
} from './client';
import {
  memoryStore,
  resolveStore,
  sessionKey,
  SESSION_TTL_MS,
  type ReportSession,
  type ReportSessionStore,
  type StateStoreKind,
} from './store';
import { requestsRemaining, tokenFingerprint, withSingleFlight } from './session';
import { classifyEnvironment, maskAccountId } from './redact';
import { FlexError, FLEX_CATEGORY_MESSAGE, type FlexErrorCategory } from './types';

/** Backoff schedule for a pending report: 5s, 10s, 20s, 40s, capped at 60s. */
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 60_000;
const JITTER_RATIO = 0.2;

function nextBackoffMs(attempts: number, random: () => number): number {
  const exponential = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);
  const jitter = exponential * JITTER_RATIO * (random() * 2 - 1);
  return Math.max(BACKOFF_BASE_MS, Math.round(exponential + jitter));
}

export interface FlexConnectionResult {
  ok: boolean;
  provider: 'ibkr-flex';
  environment: 'paper' | 'unknown';
  reportStatus: string;
  tradeCount?: number;
  /** Masked — never a full account number. */
  account?: string | null;
  period?: { from: string | null; to: string | null };
  generatedAt?: string | null;
  durationMs: number;
  category?: FlexErrorCategory;
  message?: string;
  retryAfterSeconds?: number;

  // --- safe diagnostics ---------------------------------------------------
  /** True when this call polled an existing report rather than starting one. */
  referenceReused: boolean;
  /** Age of the current report request, in seconds. Null when there is none. */
  referenceAgeSeconds: number | null;
  lastCheckedAt: string | null;
  nextRetryAt: string | null;
  /** Which store actually backed this call. Reported truthfully. */
  stateStore: StateStoreKind;
  /** Present only when the durable store was unavailable. */
  stateStoreNote?: string;
  /** Which leg answered — invaluable for diagnosis, and not a secret. */
  stage?: 'send_request' | 'get_statement' | 'none';
  requestsRemainingThisMinute?: number;
  /** Always changes between responses; proves nothing was served from cache. */
  responseGeneratedAt: string;
}

export async function checkFlexConnection(
  options: FlexClientDeps & {
    credentialSource?: FlexCredentialSource;
    signal?: AbortSignal;
    store?: ReportSessionStore;
    stateStoreNote?: string;
  } = {},
): Promise<FlexConnectionResult> {
  const deps = resolveDeps(options);
  const startedAt = deps.now();
  const source = options.credentialSource ?? envFlexCredentialSource;

  let store = options.store;
  let storeNote = options.stateStoreNote;
  if (!store) {
    const resolved = await resolveStore();
    store = resolved.store;
    storeNote = resolved.degradedReason;
  }

  const base = (): Pick<
    FlexConnectionResult,
    'provider' | 'stateStore' | 'stateStoreNote' | 'responseGeneratedAt' | 'referenceReused'
  > => ({
    provider: 'ibkr-flex',
    stateStore: store!.kind,
    ...(storeNote ? { stateStoreNote: storeNote } : {}),
    // Recomputed on every call — if two responses share this value, something
    // between here and the browser cached them.
    responseGeneratedAt: new Date(deps.now()).toISOString(),
    referenceReused: false,
  });

  const credentials = await source.getCredentials();
  if (!credentials) {
    return {
      ...base(),
      ok: false,
      environment: 'unknown',
      reportStatus: 'missing_configuration',
      category: 'missing_configuration',
      message: FLEX_CATEGORY_MESSAGE.missing_configuration,
      durationMs: deps.now() - startedAt,
      referenceAgeSeconds: null,
      lastCheckedAt: null,
      nextRetryAt: null,
      stage: 'none',
    };
  }

  const key = sessionKey(credentials.token, credentials.queryId);
  const pacingKey = tokenFingerprint(credentials.token);

  return withSingleFlight(pacingKey, async () => {
    const now = deps.now();
    const existing = await store!.getPending(key, now);

    const diagnostics = (session: ReportSession | null) => ({
      referenceAgeSeconds: session
        ? Math.max(0, Math.round((deps.now() - session.createdAt) / 1000))
        : null,
      lastCheckedAt: session?.lastCheckedAt ? new Date(session.lastCheckedAt).toISOString() : null,
      nextRetryAt: session ? new Date(session.nextAllowedCheckAt).toISOString() : null,
      requestsRemainingThisMinute: requestsRemaining(pacingKey, deps.now()),
    });

    const pendingResult = (
      session: ReportSession,
      stage: FlexConnectionResult['stage'],
    ): FlexConnectionResult => ({
      ...base(),
      referenceReused: true,
      ok: false,
      environment: 'unknown',
      reportStatus: 'report_pending',
      category: 'report_pending',
      message: FLEX_CATEGORY_MESSAGE.report_pending,
      retryAfterSeconds: Math.max(1, Math.ceil((session.nextAllowedCheckAt - deps.now()) / 1000)),
      durationMs: deps.now() - startedAt,
      stage,
      ...diagnostics(session),
    });

    // A session that never completed inside its TTL stops being "pending".
    if (existing && now >= existing.expiresAt) {
      await store!.close(key, 'timeout', 'report_timeout', now);
      return {
        ...base(),
        referenceReused: true,
        ok: false,
        environment: 'unknown',
        reportStatus: 'report_timeout',
        category: 'report_timeout',
        message: FLEX_CATEGORY_MESSAGE.report_timeout,
        durationMs: deps.now() - startedAt,
        stage: 'none',
        ...diagnostics(existing),
      };
    }

    // A refresh inside the backoff window costs zero provider requests.
    if (existing && now < existing.nextAllowedCheckAt) {
      return pendingResult(existing, 'none');
    }

    let session = existing;
    let stage: FlexConnectionResult['stage'] = 'none';

    try {
      // Only start a report when there is no live session to poll.
      if (!session) {
        stage = 'send_request';
        const { referenceCode } = await sendFlexRequest(
          credentials,
          pacingKey,
          deps,
          options.signal,
        );
        session = {
          referenceCode,
          status: 'pending',
          attempts: 0,
          createdAt: deps.now(),
          lastCheckedAt: null,
          nextAllowedCheckAt: deps.now(),
          expiresAt: deps.now() + SESSION_TTL_MS,
          terminalErrorCategory: null,
        };
        await store!.upsertPending(key, session);
      }

      // Poll the existing reference. A session with no reference cannot be
      // polled — the provider never issued one — so it waits out its backoff
      // and the next eligible call retries SendRequest.
      if (!session.referenceCode) return pendingResult(session, 'send_request');

      stage = 'get_statement';
      const report = await getFlexStatement(
        credentials,
        session.referenceCode,
        pacingKey,
        deps,
        options.signal,
      );

      await store!.close(key, 'ready', null, deps.now());
      return {
        ...base(),
        referenceReused: existing !== null,
        ok: true,
        environment: classifyEnvironment(report.accountId),
        reportStatus: 'ready',
        tradeCount: report.trades.length,
        account: maskAccountId(report.accountId),
        period: { from: report.period.from, to: report.period.to },
        generatedAt: report.whenGenerated,
        durationMs: deps.now() - startedAt,
        stage: 'get_statement',
        ...diagnostics(session),
        referenceAgeSeconds: Math.max(0, Math.round((deps.now() - session.createdAt) / 1000)),
      };
    } catch (error) {
      const at = deps.now();

      if (error instanceof FlexPacingError) {
        return {
          ...base(),
          referenceReused: existing !== null,
          ok: false,
          environment: 'unknown',
          reportStatus: 'pacing_limit',
          category: 'pacing_limit',
          message: FLEX_CATEGORY_MESSAGE.pacing_limit,
          retryAfterSeconds: error.retryAfterSeconds,
          durationMs: at - startedAt,
          stage,
          ...diagnostics(session),
        };
      }

      if (error instanceof FlexError && error.category === 'report_pending') {
        // Persist the backoff on EVERY pending answer, including one from the
        // SendRequest leg where no ReferenceCode exists yet. Without this the
        // caller re-issues SendRequest on every request.
        const attempts = (session?.attempts ?? 0) + 1;
        const createdAt = session?.createdAt ?? at;
        const next: ReportSession = {
          referenceCode: session?.referenceCode ?? null,
          status: 'pending',
          attempts,
          createdAt,
          lastCheckedAt: at,
          nextAllowedCheckAt: at + nextBackoffMs(attempts, deps.random),
          expiresAt: session?.expiresAt ?? at + SESSION_TTL_MS,
          terminalErrorCategory: null,
        };
        await store!.upsertPending(key, next);
        return pendingResult(next, stage);
      }

      if (error instanceof FlexError) {
        // Terminal: this report will never arrive. Close the session so a later
        // call may legitimately request a new one.
        await store!.close(key, 'failed', error.category, at);
        return {
          ...base(),
          referenceReused: existing !== null,
          ok: false,
          environment: 'unknown',
          reportStatus: error.category,
          category: error.category,
          message: FLEX_CATEGORY_MESSAGE[error.category],
          ...(error.retryable ? { retryAfterSeconds: 30 } : {}),
          durationMs: at - startedAt,
          stage,
          ...diagnostics(session),
        };
      }

      await store!.close(key, 'failed', 'unknown', at);
      return {
        ...base(),
        ok: false,
        environment: 'unknown',
        reportStatus: 'unknown',
        category: 'unknown',
        message: FLEX_CATEGORY_MESSAGE.unknown,
        durationMs: at - startedAt,
        stage,
        ...diagnostics(session),
      };
    }
  });
}

/** Exported for tests that need a deterministic, isolated store. */
export { memoryStore };

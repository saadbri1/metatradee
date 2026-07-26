import 'server-only';

/**
 * Phase 1 verification: can MetaTradee generate, retrieve and parse the saved
 * "MetaTradee Activity" Flex query?
 *
 * POLLING PROTOCOL — the important part.
 *
 * A Flex report is requested ONCE and then polled. So:
 *   1. If a pending ReferenceCode exists for this token, only `/GetStatement`
 *      is called. `/SendRequest` is not called again.
 *   2. `/SendRequest` runs only when there is no pending reference — because
 *      none was ever made, the last one succeeded, it failed terminally, or it
 *      aged out of its TTL.
 *   3. While a report is pending, the next poll is scheduled with exponential
 *      backoff plus jitter. A browser refresh arriving before that moment is
 *      answered from stored state and makes NO IBKR request at all.
 *   4. Only one sequence per token is ever in flight; concurrent callers share
 *      its result rather than starting a second one.
 *   5. `pacing_limit` is never retried automatically — it is surfaced with a
 *      `retryAfterSeconds` so the caller waits deliberately.
 *
 * This module owns the SAFE PROJECTION: every field of the result is built
 * explicitly, so no provider value can leak by accident. NOTHING IS PERSISTED —
 * trades are parsed, counted, and dropped.
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
  backoffPending,
  clearPending,
  getPending,
  requestsRemaining,
  setPending,
  tokenFingerprint,
  withSingleFlight,
} from './session';
import { classifyEnvironment, maskAccountId } from './redact';
import { FlexError, FLEX_CATEGORY_MESSAGE, type FlexErrorCategory } from './types';

/** Poll attempts inside a single request before answering "still pending". */
const MAX_POLLS_PER_REQUEST = 2;

export interface FlexConnectionResult {
  ok: boolean;
  provider: 'ibkr-flex';
  environment: 'paper' | 'unknown';
  /** 'ready' on success; otherwise the safe category name. */
  reportStatus: string;
  tradeCount?: number;
  /** Masked — never a full account number. */
  account?: string | null;
  period?: { from: string | null; to: string | null };
  generatedAt?: string | null;
  durationMs: number;
  category?: FlexErrorCategory;
  message?: string;
  /** How long to wait before calling again. Safe, coarse, never a secret. */
  retryAfterSeconds?: number;
  /** True when this call reused an existing pending report. Diagnostics only. */
  reusedReference?: boolean;
  /** Requests left in the current rolling minute. Diagnostics only. */
  requestsRemainingThisMinute?: number;
}

export async function checkFlexConnection(
  options: FlexClientDeps & {
    credentialSource?: FlexCredentialSource;
    signal?: AbortSignal;
    maxPolls?: number;
  } = {},
): Promise<FlexConnectionResult> {
  const deps = resolveDeps(options);
  const startedAt = deps.now();
  const source = options.credentialSource ?? envFlexCredentialSource;

  const finish = (partial: Partial<FlexConnectionResult>): FlexConnectionResult => ({
    ok: false,
    provider: 'ibkr-flex',
    environment: 'unknown',
    reportStatus: 'unknown',
    durationMs: deps.now() - startedAt,
    ...partial,
  });

  const fail = (
    category: FlexErrorCategory,
    extra: Partial<FlexConnectionResult> = {},
  ): FlexConnectionResult =>
    finish({
      reportStatus: category,
      category,
      message: FLEX_CATEGORY_MESSAGE[category],
      ...extra,
    });

  const credentials = await source.getCredentials();
  // Fail closed: no credentials means no request is made at all.
  if (!credentials) return fail('missing_configuration');

  const key = tokenFingerprint(credentials.token);

  // One sequence per token. A concurrent caller shares this result instead of
  // starting a second set of IBKR requests.
  return withSingleFlight(key, async () => {
    const now = deps.now();
    let pending = getPending(key, now);

    // A refresh that lands inside the backoff window costs zero IBKR requests.
    if (pending && now < pending.nextEligibleAt) {
      return fail('report_pending', {
        retryAfterSeconds: Math.max(1, Math.ceil((pending.nextEligibleAt - now) / 1_000)),
        reusedReference: true,
        requestsRemainingThisMinute: requestsRemaining(key, now),
      });
    }

    try {
      // Generate a report ONLY when there is no live reference to poll.
      if (!pending) {
        const { referenceCode } = await sendFlexRequest(credentials, key, deps, options.signal);
        pending = setPending(key, referenceCode, deps.now());
      }

      const maxPolls = options.maxPolls ?? MAX_POLLS_PER_REQUEST;

      for (let attempt = 0; attempt < maxPolls; attempt += 1) {
        try {
          const report = await getFlexStatement(
            credentials,
            pending.referenceCode,
            key,
            deps,
            options.signal,
          );
          // Terminal success — the reference is spent.
          clearPending(key);
          return finish({
            ok: true,
            environment: classifyEnvironment(report.accountId),
            reportStatus: 'ready',
            tradeCount: report.trades.length,
            account: maskAccountId(report.accountId),
            period: { from: report.period.from, to: report.period.to },
            generatedAt: report.whenGenerated,
            requestsRemainingThisMinute: requestsRemaining(key, deps.now()),
          });
        } catch (error) {
          if (error instanceof FlexError && error.category === 'report_pending') {
            const next = backoffPending(key, deps.now(), deps.random);
            const isLastAttempt = attempt === maxPolls - 1;
            if (isLastAttempt) {
              return fail('report_pending', {
                retryAfterSeconds: next
                  ? Math.max(1, Math.ceil((next.nextEligibleAt - deps.now()) / 1_000))
                  : 5,
                reusedReference: true,
                requestsRemainingThisMinute: requestsRemaining(key, deps.now()),
              });
            }
            // Wait out the jittered backoff before the next poll in this call.
            const waitMs = Math.max(0, (next?.nextEligibleAt ?? 0) - deps.now());
            await deps.sleep(waitMs, options.signal);
            continue;
          }
          throw error;
        }
      }

      return fail('report_pending', { reusedReference: true, retryAfterSeconds: 5 });
    } catch (error) {
      // Pacing is surfaced, never retried.
      if (error instanceof FlexPacingError) {
        return fail('pacing_limit', {
          retryAfterSeconds: error.retryAfterSeconds,
          reusedReference: Boolean(pending),
          requestsRemainingThisMinute: requestsRemaining(key, deps.now()),
        });
      }
      if (error instanceof FlexError) {
        // A terminal error means this reference will never produce a report;
        // drop it so a later call may legitimately request a new one.
        if (error.category !== 'report_pending') clearPending(key);
        return fail(error.category, {
          retryAfterSeconds: error.retryable ? 30 : undefined,
          requestsRemainingThisMinute: requestsRemaining(key, deps.now()),
        });
      }
      clearPending(key);
      return fail('unknown');
    }
  });
}

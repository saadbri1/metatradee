import 'server-only';

/**
 * Phase 1 verification: can MetaTradee generate, retrieve and parse the saved
 * "MetaTradee Activity" Flex query?
 *
 * This module owns the SAFE PROJECTION — it is the last place a raw value could
 * escape, so every field of the result is constructed explicitly here. Nothing
 * is spread from a provider payload, so a new IBKR attribute can never leak by
 * accident.
 *
 * NOTHING IS PERSISTED in this phase: trades are parsed, counted, and dropped.
 */
import { envFlexCredentialSource, type FlexCredentialSource } from './credentials';
import { fetchFlexReport, type FlexClientDeps } from './client';
import { classifyEnvironment, maskAccountId } from './redact';
import { FlexError, FLEX_CATEGORY_MESSAGE, type FlexErrorCategory } from './types';

export interface FlexConnectionResult {
  ok: boolean;
  provider: 'ibkr-flex';
  environment: 'paper' | 'unknown';
  /** 'ready' on success; otherwise the safe category name. */
  reportStatus: string;
  /** Present only on success. Never inferred when the report was unreadable. */
  tradeCount?: number;
  /** Masked — never a full account number. */
  account?: string | null;
  period?: { from: string | null; to: string | null };
  generatedAt?: string | null;
  durationMs: number;
  /** Present only on failure. One of the fixed safe categories. */
  category?: FlexErrorCategory;
  /** Present only on failure. Fixed text — never IBKR's own message. */
  message?: string;
}

export async function checkFlexConnection(
  options: FlexClientDeps & {
    credentialSource?: FlexCredentialSource;
    signal?: AbortSignal;
    maxAttempts?: number;
  } = {},
): Promise<FlexConnectionResult> {
  const startedAt = Date.now();
  const source = options.credentialSource ?? envFlexCredentialSource;

  const fail = (category: FlexErrorCategory): FlexConnectionResult => ({
    ok: false,
    provider: 'ibkr-flex',
    environment: 'unknown',
    reportStatus: category,
    durationMs: Date.now() - startedAt,
    category,
    message: FLEX_CATEGORY_MESSAGE[category],
  });

  const credentials = await source.getCredentials();
  // Fail closed: no credentials means no request is made at all.
  if (!credentials) return fail('missing_configuration');

  try {
    const report = await fetchFlexReport(credentials, options);
    return {
      ok: true,
      provider: 'ibkr-flex',
      environment: classifyEnvironment(report.accountId),
      reportStatus: 'ready',
      // A valid report with no trades is a real, successful answer.
      tradeCount: report.trades.length,
      account: maskAccountId(report.accountId),
      period: { from: report.period.from, to: report.period.to },
      generatedAt: report.whenGenerated,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    // Anything uncategorised becomes `unknown` — a raw error never escapes.
    return fail(error instanceof FlexError ? error.category : 'unknown');
  }
}

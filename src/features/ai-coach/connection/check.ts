import 'server-only';

/**
 * One minimal OpenAI **Responses API** request, used only to answer a single
 * question: can this deployment reach OpenAI with the configured key?
 *
 * This is a connection probe, NOT the AI Coach. It deliberately has no prompt
 * engineering, no schema, no retry, and no persistence.
 *
 * SECRET HANDLING
 * - `OPENAI_API_KEY` is read from server env and used only as an Authorization
 *   header on this one request.
 * - The key is never returned, never logged, and never placed in an error.
 * - The provider's own error text is discarded; only a fixed category from
 *   `categories.ts` escapes this module.
 *
 * COST
 * - `gpt-5-mini` with a 16-token input and a hard `max_output_tokens` cap, so a
 *   check costs a fraction of a cent. A 10s timeout bounds the wall clock.
 */
import { serverEnv } from '@/config/env';
import {
  categorizeHttpFailure,
  categorizeTransportError,
  CATEGORY_MESSAGE,
  type ConnectionCategory,
} from './categories';

/** The low-cost model this first connection test is pinned to. */
export const CONNECTION_CHECK_MODEL = 'gpt-5-mini';

const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const TIMEOUT_MS = 10_000;
/** Enough for a one-word reply; caps the cost of a probe. */
const MAX_OUTPUT_TOKENS = 16;

export interface ConnectionCheckResult {
  ok: boolean;
  /** Present only on failure. One of the fixed safe categories. */
  category?: ConnectionCategory;
  /** Present only on failure. Fixed text — never provider output. */
  message?: string;
  /** The model the probe targeted. Not a secret. */
  model: string;
  /** Round-trip milliseconds, for a rough reachability signal. */
  durationMs: number;
}

interface ResponsesErrorBody {
  error?: { code?: string | null; type?: string | null };
}

/**
 * Read the provider's error CODE only — never its message.
 *
 * The body is parsed defensively: a non-JSON error page (a proxy or gateway,
 * say) must not throw and must not leak its contents.
 */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as ResponsesErrorBody;
    return body.error?.code ?? body.error?.type ?? null;
  } catch {
    return null;
  }
}

export async function checkOpenAIConnection(): Promise<ConnectionCheckResult> {
  const startedAt = Date.now();
  const finish = (partial: Omit<ConnectionCheckResult, 'model' | 'durationMs'>) => ({
    ...partial,
    model: CONNECTION_CHECK_MODEL,
    durationMs: Date.now() - startedAt,
  });

  const apiKey = serverEnv().OPENAI_API_KEY;
  if (!apiKey) {
    // Fail closed: an unset key is an invalid credential, not a network fault,
    // and we make no request at all.
    return finish({
      ok: false,
      category: 'invalid_key',
      message: 'OPENAI_API_KEY is not configured for this environment.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(RESPONSES_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CONNECTION_CHECK_MODEL,
        input: 'Reply with the single word: ok',
        max_output_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      const category = categorizeHttpFailure(response.status, await readErrorCode(response));
      return finish({ ok: false, category, message: CATEGORY_MESSAGE[category] });
    }

    // A 200 from /v1/responses means the key authenticated, the account is
    // billable, and the model is accessible. That is the whole question.
    return finish({ ok: true });
  } catch (error) {
    const category = categorizeTransportError(error);
    return finish({ ok: false, category, message: CATEGORY_MESSAGE[category] });
  } finally {
    clearTimeout(timeout);
  }
}

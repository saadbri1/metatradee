/**
 * Shared timeout + retry/backoff used by every real adapter, so retry policy is
 * identical across vendors (provider-independence extends to failure handling).
 */
import { AIError, type AIProviderName } from './types';

/** Fetch with an AbortController timeout, normalizing aborts/network into AIError. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  provider: AIProviderName,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('timeout', `Request exceeded ${timeoutMs}ms`, provider, true);
    }
    throw new AIError('network', (err as Error).message, provider, true);
  } finally {
    clearTimeout(timer);
  }
}

/** Map an HTTP status to a normalized, possibly-retryable AIError. */
export function errorFromStatus(status: number, body: string, provider: AIProviderName): AIError {
  if (status === 401 || status === 403) {
    return new AIError('auth', `Auth failed (${status})`, provider, false);
  }
  if (status === 429) return new AIError('rate_limit', 'Rate limited', provider, true);
  if (status >= 500) return new AIError('provider_error', `Upstream ${status}`, provider, true);
  return new AIError('provider_error', `HTTP ${status}: ${body.slice(0, 200)}`, provider, false);
}

/**
 * Retry `fn` on retryable AIErrors with exponential backoff + jitter.
 * `sleep` is injectable so tests run instantly and deterministically.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const base = opts.baseDelayMs ?? 250;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof AIError && err.retryable;
      if (!retryable || attempt === retries) throw err;
      await sleep(base * 2 ** attempt + Math.floor(Math.random() * 50));
    }
  }
  throw lastErr;
}

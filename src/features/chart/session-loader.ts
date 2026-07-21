/**
 * Chunk orchestration for a bounded chart session.
 *
 * Deliberately separate from request transport (`api.ts`) and from session
 * assembly (`session.ts`): this module owns only *how many* chunk loads run at
 * once, when a failed chunk is retried, and how progress is reported. It has no
 * React, no DOM, no vendor, and no knowledge of candles — it is generic over
 * the chunk and result types, so it is testable with a fake loader and a fake
 * clock.
 *
 * WHY CONCURRENCY: a calendar month of 1-minute bars plans to roughly thirty
 * chunks. Run sequentially that is thirty round-trips end to end, which is what
 * made wide ranges feel unreliable. A small pool cuts wall-clock time by close
 * to the pool size while staying far below anything that would look like abuse
 * of a metered provider — the cap is deliberately low, and every request still
 * passes the server's own per-request limits.
 *
 * DETERMINISM: results are written into a slot array indexed by chunk position,
 * never appended in completion order. Two runs over the same plan therefore
 * assemble identically no matter how the network interleaves.
 */

/** Backoff scheduler, injected so tests need no real timers. */
export interface RetryScheduler {
  wait(delayMs: number, signal?: AbortSignal): Promise<void>;
}

export const realScheduler: RetryScheduler = {
  wait(delayMs, signal) {
    return new Promise((resolve, reject) => {
      const id = setTimeout(resolve, delayMs);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(id);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        },
        { once: true },
      );
    });
  },
};

export interface SessionLoadProgress {
  /** Chunks that have settled — loaded, or skipped as genuinely empty. */
  completed: number;
  total: number;
  /** Chunks that returned no data (closed market), not failures. */
  empty: number;
  /** Retries performed so far across all chunks. */
  retries: number;
}

export interface ChunkLoadOptions<C, T> {
  /** Load one chunk. Must honour the abort signal. */
  load: (chunk: C, signal?: AbortSignal) => Promise<T>;
  /** True when a chunk yielded no data — skipped, not failed. */
  isEmpty?: (error: unknown) => boolean;
  /** True when an error is worth another attempt (rate limit, timeout, network). */
  isRetryable?: (error: unknown) => boolean;
  onProgress?: (progress: SessionLoadProgress) => void;
  signal?: AbortSignal;
  scheduler?: RetryScheduler;
  /** Simultaneous in-flight chunk loads. Clamped to [1, MAX_CONCURRENCY]. */
  concurrency?: number;
  /** Total attempts per chunk, including the first. Clamped to [1, 5]. */
  maxAttempts?: number;
  /** First backoff step; doubles per retry. */
  baseDelayMs?: number;
}

export const DEFAULT_CONCURRENCY = 3;
export const MAX_CONCURRENCY = 6;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BASE_DELAY_MS = 400;

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Load every chunk with bounded concurrency and retry, preserving chunk order.
 *
 * Returns results positionally: empty/skipped chunks are omitted from the
 * output but still counted in progress, so the caller can distinguish "closed
 * market" from "nothing loaded".
 */
export async function loadChunks<C, T>(
  chunks: readonly C[],
  options: ChunkLoadOptions<C, T>,
): Promise<T[]> {
  const {
    load,
    isEmpty = () => false,
    isRetryable = () => false,
    onProgress,
    signal,
    scheduler = realScheduler,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
  } = options;

  const concurrency = Math.min(
    Math.max(Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY), 1),
    MAX_CONCURRENCY,
  );
  const maxAttempts = Math.min(
    Math.max(Math.floor(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS), 1),
    5,
  );

  const slots: Array<T | undefined> = new Array(chunks.length);
  let completed = 0;
  let empty = 0;
  let retries = 0;
  let nextIndex = 0;
  /** First non-retryable failure; the whole load fails with it. */
  let failure: unknown = null;

  const report = () => onProgress?.({ completed, total: chunks.length, empty, retries });
  report();

  async function loadOne(index: number): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) throw abortError();
      try {
        slots[index] = await load(chunks[index]!, signal);
        return;
      } catch (error) {
        if (isAbort(error)) throw error;
        if (isEmpty(error)) {
          empty += 1;
          return; // A closed market is real data, not a failure.
        }
        if (attempt < maxAttempts && isRetryable(error)) {
          retries += 1;
          report();
          // Exponential backoff. Bounded by maxAttempts, so never unbounded.
          await scheduler.wait(baseDelayMs * 2 ** (attempt - 1), signal);
          continue;
        }
        throw error;
      }
    }
  }

  async function worker(): Promise<void> {
    for (;;) {
      if (failure !== null || signal?.aborted) return;
      const index = nextIndex++;
      if (index >= chunks.length) return;
      try {
        await loadOne(index);
        completed += 1;
        report();
      } catch (error) {
        // First failure wins and stops the pool; later ones are redundant.
        if (failure === null) failure = error;
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));

  if (failure !== null) throw failure;
  if (signal?.aborted) throw abortError();

  return slots.filter((value): value is T => value !== undefined);
}

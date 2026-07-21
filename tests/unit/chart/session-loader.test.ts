/**
 * Chunk orchestration for wide chart sessions.
 *
 * A fake loader and a fake scheduler drive every case, so there are no timers
 * and no network. The properties under test are the ones that make a month of
 * 1-minute data load reliably: bounded concurrency, order-independent
 * determinism, retry only where retry helps, honest progress, and prompt
 * cancellation.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
  loadChunks,
  type RetryScheduler,
  type SessionLoadProgress,
} from '@/features/chart/session-loader';

/** Records waits instead of performing them. */
function fakeScheduler(): RetryScheduler & { waits: number[] } {
  const waits: number[] = [];
  return {
    waits,
    async wait(delayMs: number) {
      waits.push(delayMs);
    },
  };
}

const chunks = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

describe('ordering and determinism', () => {
  it('returns results in chunk order even when they settle out of order', async () => {
    // Later chunks resolve first; the output must still follow plan order.
    const load = async (chunk: string) => {
      const index = Number(chunk.slice(1));
      await Promise.all(Array.from({ length: 10 - index }, () => Promise.resolve()));
      return chunk.toUpperCase();
    };
    const result = await loadChunks(chunks(6), { load, concurrency: 6 });
    expect(result).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'C5']);
  });

  it('produces identical output across repeated runs', async () => {
    const load = async (chunk: string) => chunk.toUpperCase();
    const a = await loadChunks(chunks(12), { load, concurrency: 4 });
    const b = await loadChunks(chunks(12), { load, concurrency: 4 });
    expect(a).toEqual(b);
  });

  it('handles an empty plan without calling the loader', async () => {
    const load = vi.fn();
    expect(await loadChunks([], { load })).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });
});

describe('bounded concurrency', () => {
  it('never exceeds the requested pool size', async () => {
    let inFlight = 0;
    let peak = 0;
    const load = async (chunk: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      await Promise.resolve();
      inFlight -= 1;
      return chunk;
    };
    await loadChunks(chunks(20), { load, concurrency: 3 });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // genuinely parallel, not accidentally serial
  });

  it('clamps the pool to a sane ceiling and floor', async () => {
    let peak = 0;
    let inFlight = 0;
    const load = async (chunk: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return chunk;
    };
    await loadChunks(chunks(30), { load, concurrency: 999 });
    expect(peak).toBeLessThanOrEqual(MAX_CONCURRENCY);

    peak = 0;
    await loadChunks(chunks(5), { load, concurrency: 0 });
    expect(peak).toBe(1);
  });

  it('defaults to a conservative pool for a metered provider', () => {
    expect(DEFAULT_CONCURRENCY).toBeLessThanOrEqual(3);
  });
});

describe('empty chunks', () => {
  it('skips genuinely empty chunks without failing, and counts them', async () => {
    const load = async (chunk: string) => {
      if (chunk === 'c1' || chunk === 'c3') throw new Error('EMPTY');
      return chunk;
    };
    const progress: SessionLoadProgress[] = [];
    const result = await loadChunks(chunks(5), {
      load,
      isEmpty: (error) => error instanceof Error && error.message === 'EMPTY',
      onProgress: (p) => progress.push(p),
      concurrency: 1,
    });
    expect(result).toEqual(['c0', 'c2', 'c4']);
    expect(progress.at(-1)).toMatchObject({ completed: 5, total: 5, empty: 2 });
  });
});

describe('retry policy', () => {
  it('retries a retryable failure with exponential backoff and succeeds', async () => {
    const scheduler = fakeScheduler();
    let attempts = 0;
    const load = async (chunk: string) => {
      if (chunk === 'c0') {
        attempts += 1;
        if (attempts < 3) throw new Error('RETRY');
        return chunk;
      }
      return chunk;
    };
    const result = await loadChunks(chunks(2), {
      load,
      isRetryable: (error) => error instanceof Error && error.message === 'RETRY',
      scheduler,
      concurrency: 1,
      baseDelayMs: 100,
    });
    expect(result).toEqual(['c0', 'c1']);
    expect(attempts).toBe(3);
    expect(scheduler.waits).toEqual([100, 200]); // doubling, bounded
  });

  it('never retries a non-retryable failure', async () => {
    const scheduler = fakeScheduler();
    let calls = 0;
    const load = async () => {
      calls += 1;
      throw new Error('VALIDATION');
    };
    await expect(
      loadChunks(chunks(3), { load, isRetryable: () => false, scheduler, concurrency: 1 }),
    ).rejects.toThrow('VALIDATION');
    expect(calls).toBe(1);
    expect(scheduler.waits).toEqual([]);
  });

  it('gives up after the attempt cap and surfaces the real error', async () => {
    const scheduler = fakeScheduler();
    let calls = 0;
    const load = async () => {
      calls += 1;
      throw new Error('RETRY');
    };
    await expect(
      loadChunks(chunks(1), {
        load,
        isRetryable: () => true,
        scheduler,
        maxAttempts: 3,
        concurrency: 1,
      }),
    ).rejects.toThrow('RETRY');
    expect(calls).toBe(3); // bounded, never infinite
  });

  it('reports retries in progress so a slow load is explainable', async () => {
    const scheduler = fakeScheduler();
    let attempts = 0;
    const progress: SessionLoadProgress[] = [];
    await loadChunks(chunks(1), {
      load: async (chunk) => {
        attempts += 1;
        if (attempts < 2) throw new Error('RETRY');
        return chunk;
      },
      isRetryable: () => true,
      scheduler,
      onProgress: (p) => progress.push(p),
      concurrency: 1,
    });
    expect(progress.some((p) => p.retries === 1)).toBe(true);
  });
});

describe('progress', () => {
  it('reports an initial zero state and a final complete state', async () => {
    const progress: SessionLoadProgress[] = [];
    await loadChunks(chunks(4), {
      load: async (chunk) => chunk,
      onProgress: (p) => progress.push(p),
      concurrency: 2,
    });
    expect(progress[0]).toMatchObject({ completed: 0, total: 4 });
    expect(progress.at(-1)).toMatchObject({ completed: 4, total: 4, empty: 0 });
    // Monotonic — progress never goes backwards.
    const completions = progress.map((p) => p.completed);
    expect(completions).toEqual([...completions].sort((a, b) => a - b));
  });
});

describe('cancellation', () => {
  it('rejects with AbortError when the signal is already aborted', async () => {
    const load = vi.fn();
    await expect(
      loadChunks(chunks(3), { load, signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(load).not.toHaveBeenCalled();
  });

  it('stops starting new chunks once aborted mid-flight', async () => {
    const controller = new AbortController();
    let started = 0;
    const load = async (chunk: string) => {
      started += 1;
      if (started === 2) controller.abort();
      return chunk;
    };
    await expect(
      loadChunks(chunks(20), { load, signal: controller.signal, concurrency: 1 }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(started).toBeLessThan(20); // the pool stopped early
  });

  it('propagates a loader abort unchanged rather than retrying it', async () => {
    const scheduler = fakeScheduler();
    const load = async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    };
    await expect(
      loadChunks(chunks(2), { load, isRetryable: () => true, scheduler, concurrency: 1 }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(scheduler.waits).toEqual([]); // a cancelled load is never retried
  });
});

describe('failure handling', () => {
  it('stops the pool on the first non-retryable failure', async () => {
    let started = 0;
    const load = async (chunk: string) => {
      started += 1;
      if (chunk === 'c1') throw new Error('FATAL');
      return chunk;
    };
    await expect(loadChunks(chunks(30), { load, concurrency: 2 })).rejects.toThrow('FATAL');
    expect(started).toBeLessThan(30);
  });
});

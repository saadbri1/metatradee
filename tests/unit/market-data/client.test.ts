/**
 * Server-only Databento client (Phase 12.5).
 *
 * `fetch` is stubbed in every test — no real provider request is made here, so
 * the suite is free to run and never bills the account. Response bodies mirror
 * the shape observed in a real authenticated OHLCV response: JSON Lines, the
 * timestamp nested at `hd.ts_event`, and every numeric field delivered as a
 * fixed-point string.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// `server-only` throws outside a React Server Component graph; neutralise it so
// the module under test is importable. This does not weaken the boundary — the
// real import still fails a client bundle at build time.
vi.mock('server-only', () => ({}));

const TEST_KEY = 'db-test-key-SENTINEL-do-not-leak';
let currentKey: string | undefined = TEST_KEY;

vi.mock('@/config/env', () => ({
  serverEnv: () => ({ DATABENTO_API_KEY: currentKey }),
}));

const { fetchCandles, MarketDataError } = await import('@/features/market-data/databento/client');

/** One provider OHLCV record, in the exact live-observed shape. */
function ohlcvLine(
  timeSeconds: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
): string {
  const fp = (n: number) => String(Math.round(n * 1e9));
  return JSON.stringify({
    hd: {
      ts_event: String(timeSeconds * 1e9),
      rtype: 33,
      publisher_id: 1,
      instrument_id: 42,
    },
    open: fp(open),
    high: fp(high),
    low: fp(low),
    close: fp(close),
    volume: String(volume),
  });
}

function okResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'application/jsonl' } });
}

/** Five consecutive 1-minute bars starting at an exact 5-minute boundary. */
const T0 = 1654548600; // 2022-06-06T20:50:00Z
const FIVE_MINUTES = [
  ohlcvLine(T0, 4120.5, 4121.0, 4120.0, 4120.75, 100),
  ohlcvLine(T0 + 60, 4120.75, 4122.0, 4120.5, 4121.5, 110),
  ohlcvLine(T0 + 120, 4121.5, 4121.75, 4119.0, 4119.25, 120),
  ohlcvLine(T0 + 180, 4119.25, 4120.0, 4118.5, 4119.75, 130),
  ohlcvLine(T0 + 240, 4119.75, 4123.0, 4119.5, 4122.5, 140),
].join('\n');

const BASE = { symbol: 'ESZ5', start: '2025-12-01T00:00:00', end: '2025-12-01T00:05:00' } as const;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  currentKey = TEST_KEY;
  fetchMock = vi.fn(async () => okResponse(FIVE_MINUTES));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The form body of the most recent request, parsed. */
function lastForm(): URLSearchParams {
  const init = fetchMock.mock.calls[0]![1] as RequestInit;
  return new URLSearchParams(init.body as string);
}

function lastHeaders(): Record<string, string> {
  const init = fetchMock.mock.calls[0]![1] as RequestInit;
  return init.headers as Record<string, string>;
}

describe('configuration', () => {
  it('fails closed with `not_configured` when the key is missing', async () => {
    currentKey = undefined;
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({
      code: 'not_configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an empty-string key as unconfigured and makes no paid request', async () => {
    currentKey = '';
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({
      code: 'not_configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('symbol policy', () => {
  it.each([
    ['bare root', 'ES'],
    ['parent symbol', 'ES.FUT'],
    ['continuous front month', 'ES.v.0'],
    ['continuous calendar', 'ES.c.0'],
    ['unapproved root', 'CLZ5'],
    ['bad month code', 'ESA5'],
  ])('rejects %s without contacting the provider', async (_label, symbol) => {
    await expect(fetchCandles({ ...BASE, symbol, timeframe: '1m' })).rejects.toMatchObject({
      code: 'invalid_symbol',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('request contract', () => {
  it('POSTs to the verified historical endpoint', async () => {
    await fetchCandles({ ...BASE, timeframe: '1m' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://hist.databento.com/v0/timeseries.get_range');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('sends the exact approved form parameters', async () => {
    await fetchCandles({ ...BASE, timeframe: '1m' });
    const form = lastForm();
    expect(Object.fromEntries(form)).toMatchObject({
      dataset: 'GLBX.MDP3',
      symbols: 'ESZ5',
      schema: 'ohlcv-1m',
      stype_in: 'raw_symbol',
      encoding: 'json',
      compression: 'none',
      pretty_px: 'false',
      pretty_ts: 'false',
      start: BASE.start,
      end: BASE.end,
    });
  });

  it('always sends a bounded row limit, and clamps an excessive one', async () => {
    await fetchCandles({ ...BASE, timeframe: '1m' });
    expect(Number(lastForm().get('limit'))).toBe(5_000);

    fetchMock.mockClear();
    await fetchCandles({ ...BASE, timeframe: '1m', limit: 10_000_000 });
    expect(Number(lastForm().get('limit'))).toBe(10_000);
  });

  it('authenticates with HTTP Basic — key as username, empty password', async () => {
    await fetchCandles({ ...BASE, timeframe: '1m' });
    const auth = lastHeaders().Authorization!;
    expect(auth.startsWith('Basic ')).toBe(true);
    expect(Buffer.from(auth.slice(6), 'base64').toString()).toBe(`${TEST_KEY}:`);
  });

  it('never puts the key in the URL or the request body', async () => {
    await fetchCandles({ ...BASE, timeframe: '1m' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain(TEST_KEY);
    expect(String((init as RequestInit).body)).not.toContain(TEST_KEY);
  });
});

describe('timeframe → schema mapping', () => {
  it('requests ohlcv-1m natively for 1m and returns every bar', async () => {
    const r = await fetchCandles({ ...BASE, timeframe: '1m' });
    expect(lastForm().get('schema')).toBe('ohlcv-1m');
    expect(r.schema).toBe('ohlcv-1m');
    expect(r.candles).toHaveLength(5);
  });

  it('requests ohlcv-1h natively for 1h', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(ohlcvLine(T0, 4120, 4130, 4110, 4125, 9000)));
    const r = await fetchCandles({ ...BASE, timeframe: '1h' });
    expect(lastForm().get('schema')).toBe('ohlcv-1h');
    expect(r.candles).toHaveLength(1);
  });

  it('derives 5m from 1m — one bar with correct OHLCV', async () => {
    const r = await fetchCandles({ ...BASE, timeframe: '5m' });
    expect(lastForm().get('schema')).toBe('ohlcv-1m');
    expect(r.schema).toBe('ohlcv-1m');
    expect(r.candles).toHaveLength(1);
    expect(r.candles[0]).toMatchObject({
      time: T0,
      open: 4120.5, // first minute's open
      high: 4123.0, // max across the window
      low: 4118.5, // min across the window
      close: 4122.5, // last minute's close
      volume: 600, // 100+110+120+130+140
    });
  });

  it('derives 15m from 1m, collapsing the window into a single bucket', async () => {
    const r = await fetchCandles({ ...BASE, timeframe: '15m' });
    expect(lastForm().get('schema')).toBe('ohlcv-1m');
    expect(r.candles).toHaveLength(1);
    // T0 is 20:50:00Z, which is NOT a 15-minute boundary — it belongs to the
    // 20:45:00Z bucket. The bar is stamped with the bucket start, not the first
    // minute present, so buckets stay aligned to the clock regardless of gaps.
    expect(r.candles[0]!.time).toBe(1654548300); // 2022-06-06T20:45:00Z
    expect(new Date(r.candles[0]!.time * 1000).toISOString()).toBe('2022-06-06T20:45:00.000Z');
    expect(r.candles[0]!.volume).toBe(600);
  });
});

describe('JSON Lines parsing', () => {
  it('flattens hd.ts_event and converts fixed-point strings', async () => {
    const r = await fetchCandles({ ...BASE, timeframe: '1m' });
    expect(r.candles[0]).toEqual({
      time: T0,
      open: 4120.5,
      high: 4121,
      low: 4120,
      close: 4120.75,
      volume: 100,
    });
  });

  it('ignores blank and trailing-newline padding', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(`\n${FIVE_MINUTES}\n\n`));
    const r = await fetchCandles({ ...BASE, timeframe: '1m' });
    expect(r.candles).toHaveLength(5);
  });

  it('reads a top-level ts_event when no hd wrapper is present', async () => {
    const flat = JSON.stringify({
      ts_event: String(T0 * 1e9),
      open: '4120500000000',
      high: '4121000000000',
      low: '4120000000000',
      close: '4120750000000',
      volume: '100',
    });
    fetchMock.mockResolvedValueOnce(okResponse(flat));
    const r = await fetchCandles({ ...BASE, timeframe: '1m' });
    expect(r.candles[0]!.time).toBe(T0);
  });

  it('rejects malformed JSON rather than silently dropping the line', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(`${FIVE_MINUTES}\n{"hd":`));
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('rejects a non-object row', async () => {
    fetchMock.mockResolvedValueOnce(okResponse('[1,2,3]'));
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('reports `empty_response` when the provider returns no rows', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(''));
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({
      code: 'empty_response',
    });
  });

  it('reports `invalid_response` when rows exist but none survive normalization', async () => {
    // low > high — structurally impossible, so normalization rejects it.
    const corrupt = JSON.stringify({
      hd: { ts_event: String(T0 * 1e9) },
      open: '4120500000000',
      high: '4000000000000',
      low: '4200000000000',
      close: '4120500000000',
      volume: '10',
    });
    fetchMock.mockResolvedValueOnce(okResponse(corrupt));
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('counts rejected rows without failing the whole series', async () => {
    const corrupt = JSON.stringify({ hd: { ts_event: 'not-a-number' }, open: 'x' });
    fetchMock.mockResolvedValueOnce(okResponse(`${FIVE_MINUTES}\n${corrupt}`));
    const r = await fetchCandles({ ...BASE, timeframe: '1m' });
    expect(r.rowsReceived).toBe(6);
    expect(r.rowsRejected).toBe(1);
    expect(r.candles).toHaveLength(5);
  });
});

describe('provider status mapping', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate_limit'],
    [500, 'provider_unavailable'],
    [503, 'provider_unavailable'],
    [400, 'provider_unavailable'],
  ])('maps HTTP %i to `%s`', async (status, code) => {
    fetchMock.mockResolvedValueOnce(new Response('provider body', { status }));
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({ code });
  });

  it('never echoes the provider error body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>Internal proxy trace: 10.0.0.1</html>', { status: 500 }),
    );
    const err = await fetchCandles({ ...BASE, timeframe: '1m' }).catch((e) => e);
    expect(err.message).not.toContain('10.0.0.1');
    expect(err.message).not.toContain('html');
  });

  it('marks rate limit and outage retryable, auth not', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 }));
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({
      retryable: true,
    });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({
      retryable: false,
    });
  });

  it('makes exactly one attempt — no automatic retries', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    await fetchCandles({ ...BASE, timeframe: '1m' }).catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('cancellation', () => {
  it('maps its own timeout to `timeout`', async () => {
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    await expect(fetchCandles({ ...BASE, timeframe: '1m', timeoutMs: 10 })).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    });
  });

  it('rejects immediately when the caller signal is already aborted', async () => {
    await expect(
      fetchCandles({ ...BASE, timeframe: '1m', signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ code: 'aborted' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('distinguishes caller cancellation mid-flight from a timeout', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const promise = fetchCandles({ ...BASE, timeframe: '1m', signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'aborted', retryable: false });
  });

  it('maps a network failure to `provider_unavailable`', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(fetchCandles({ ...BASE, timeframe: '1m' })).rejects.toMatchObject({
      code: 'provider_unavailable',
    });
  });
});

describe('secret safety', () => {
  it.each([
    ['auth failure', () => fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))],
    ['outage', () => fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }))],
    ['network error', () => fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))],
    ['malformed body', () => fetchMock.mockResolvedValueOnce(okResponse('{'))],
  ])('leaks nothing through a %s', async (_label, arrange) => {
    arrange();
    const err = (await fetchCandles({ ...BASE, timeframe: '1m' }).catch((e) => e)) as Error;
    expect(err).toBeInstanceOf(MarketDataError);
    const surfaces = [err.message, String(err.stack), JSON.stringify(err), String(err)];
    for (const s of surfaces) {
      expect(s).not.toContain(TEST_KEY);
      expect(s).not.toContain('Basic ');
    }
  });
});

describe('determinism and purity', () => {
  it('returns identical output for identical input', async () => {
    const a = await fetchCandles({ ...BASE, timeframe: '5m' });
    fetchMock.mockResolvedValueOnce(okResponse(FIVE_MINUTES));
    const b = await fetchCandles({ ...BASE, timeframe: '5m' });
    expect(a.candles).toEqual(b.candles);
  });

  it('returns candles sorted ascending even when the provider order is shuffled', async () => {
    const shuffled = FIVE_MINUTES.split('\n').reverse().join('\n');
    fetchMock.mockResolvedValueOnce(okResponse(shuffled));
    const r = await fetchCandles({ ...BASE, timeframe: '1m' });
    const times = r.candles.map((c) => c.time);
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });
});

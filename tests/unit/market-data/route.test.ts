/**
 * GET /api/market-data/candles (Phase 12.6).
 *
 * The provider client is mocked throughout — NO real Databento request is made
 * by this suite, so it never bills the account. Auth is mocked at the session
 * helper so the fail-closed path is exercised directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The client transitively imports `server-only`, which throws outside an RSC
// graph. Neutralising it lets `importOriginal` give us the REAL MarketDataError
// class, so `instanceof` in the route matches what the tests throw.
vi.mock('server-only', () => ({}));

const fetchCandlesMock = vi.fn();
const getAuthenticatedUserMock = vi.fn();

vi.mock('@/features/market-data/databento/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/market-data/databento/client')>()),
  fetchCandles: fetchCandlesMock,
}));

vi.mock('@/features/auth/server/session', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const { GET } = await import('@/app/api/market-data/candles/route');
const { MarketDataError } = await import('@/features/market-data/databento/client');

const CANDLE = {
  time: 1654548600,
  open: 4120.5,
  high: 4121,
  low: 4120,
  close: 4120.75,
  volume: 100,
};

const VALID = {
  symbol: 'ESZ5',
  timeframe: '1m',
  start: '2025-12-01T00:00:00Z',
  end: '2025-12-01T01:00:00Z',
};

function request(params: Record<string, string> = VALID): Request {
  const url = new URL('http://localhost:3000/api/market-data/candles');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1', email: 'a@b.test' });
  fetchCandlesMock.mockResolvedValue({
    symbol: 'ESZ5',
    timeframe: '1m',
    schema: 'ohlcv-1m',
    rowsReceived: 1,
    rowsRejected: 0,
    candles: [CANDLE],
  });
});

describe('authentication', () => {
  it('returns 401 for an unauthenticated caller', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const res = await GET(request());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'unauthorized' } });
  });

  it('never reaches the provider when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    await GET(request());
    expect(fetchCandlesMock).not.toHaveBeenCalled();
  });

  it('checks auth before validation — a bad symbol still returns 401', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const res = await GET(request({ ...VALID, symbol: 'ES' }));
    expect(res.status).toBe(401);
    expect(fetchCandlesMock).not.toHaveBeenCalled();
  });
});

describe('successful request', () => {
  it('returns a vendor-free envelope with normalized candles', async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: {
        symbol: 'ESZ5',
        timeframe: '1m',
        start: VALID.start,
        end: VALID.end,
        provider: 'databento',
        candles: [CANDLE],
      },
    });
  });

  it('calls the provider client exactly once', async () => {
    await GET(request());
    expect(fetchCandlesMock).toHaveBeenCalledTimes(1);
  });

  it('passes a bounded provider row limit derived from the range', async () => {
    await GET(request()); // 1 hour of 1m = 60 source bars
    expect(fetchCandlesMock.mock.calls[0]![0]).toMatchObject({
      symbol: 'ESZ5',
      timeframe: '1m',
      limit: 60,
    });
  });

  it('requests enough SOURCE bars for a derived timeframe', async () => {
    // 15m over 24h emits 96 bars but must read 1,440 one-minute bars.
    await GET(request({ ...VALID, timeframe: '15m', end: '2025-12-02T00:00:00Z' }));
    expect(fetchCandlesMock.mock.calls[0]![0].limit).toBe(1_440);
  });

  it('forwards the request signal so a dropped connection cancels the call', async () => {
    await GET(request());
    expect(fetchCandlesMock.mock.calls[0]![0].signal).toBeDefined();
  });
});

describe('symbol validation', () => {
  it.each([
    ['bare root', 'ES'],
    ['parent symbol', 'ES.FUT'],
    ['continuous front month', 'ES.v.0'],
    ['continuous calendar', 'ES.c.0'],
    ['continuous n-series', 'ES.n.0'],
    ['unapproved root', 'CLZ5'],
    ['lowercase', 'esz5'],
    ['empty', ''],
  ])('rejects %s with 422 and no provider call', async (_label, symbol) => {
    const res = await GET(request({ ...VALID, symbol }));
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'validation_failed' } });
    expect(fetchCandlesMock).not.toHaveBeenCalled();
  });
});

describe('parameter validation', () => {
  it('rejects an unsupported timeframe', async () => {
    const res = await GET(request({ ...VALID, timeframe: '4h' }));
    expect(res.status).toBe(422);
    expect(fetchCandlesMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed date', async () => {
    const res = await GET(request({ ...VALID, start: 'yesterday' }));
    expect(res.status).toBe(422);
  });

  it('rejects a datetime without an explicit UTC offset', async () => {
    const res = await GET(request({ ...VALID, start: '2025-12-01T00:00:00' }));
    expect(res.status).toBe(422);
  });

  it('rejects a reversed range', async () => {
    const res = await GET(
      request({ ...VALID, start: '2025-12-01T06:00:00Z', end: '2025-12-01T00:00:00Z' }),
    );
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining('after start') },
    });
    expect(fetchCandlesMock).not.toHaveBeenCalled();
  });

  it('rejects an equal start and end', async () => {
    const res = await GET(request({ ...VALID, end: VALID.start }));
    expect(res.status).toBe(422);
  });

  it('rejects an unknown query parameter rather than ignoring it', async () => {
    const res = await GET(request({ ...VALID, symbols: 'NQZ5' }));
    expect(res.status).toBe(422);
    expect(fetchCandlesMock).not.toHaveBeenCalled();
  });

  it('rejects a missing parameter', async () => {
    const res = await GET(request({ symbol: 'ESZ5', timeframe: '1m' }));
    expect(res.status).toBe(422);
  });
});

describe('cost limits', () => {
  it('rejects a span beyond the per-timeframe maximum', async () => {
    const res = await GET(
      request({
        ...VALID,
        timeframe: '1h',
        start: '2025-01-01T00:00:00Z',
        end: '2025-12-01T00:00:00Z',
      }),
    );
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining('at most 90 day') },
    });
    expect(fetchCandlesMock).not.toHaveBeenCalled();
  });

  it('rejects a 1m range that would exceed the output row cap', async () => {
    // 7 days of 1m = 10,080 bars, above the 5,000 output cap.
    const res = await GET(
      request({ ...VALID, start: '2025-12-01T00:00:00Z', end: '2025-12-08T00:00:00Z' }),
    );
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining('5000 limit') },
    });
  });

  it('rejects a derived timeframe whose SOURCE rows exceed the fetch cap', async () => {
    // 15m over 7 days emits only 672 bars, but must read 10,080 one-minute
    // bars — above the 10,000 source cap. Without this rule the fetch would be
    // silently truncated and the series would look complete but be short.
    const res = await GET(
      request({
        ...VALID,
        timeframe: '15m',
        start: '2025-12-01T00:00:00Z',
        end: '2025-12-08T00:00:00Z',
      }),
    );
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining('source bars') },
    });
    expect(fetchCandlesMock).not.toHaveBeenCalled();
  });

  it('accepts a range that sits just inside every limit', async () => {
    const res = await GET(
      request({
        ...VALID,
        timeframe: '1h',
        start: '2025-09-01T00:00:00Z',
        end: '2025-11-29T00:00:00Z',
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe('provider error mapping', () => {
  it.each([
    ['not_configured', 503, 'market_data_not_configured'],
    ['timeout', 504, 'market_data_timeout'],
    ['aborted', 503, 'request_cancelled'],
    ['auth', 502, 'market_data_unavailable'],
    ['rate_limit', 429, 'market_data_rate_limited'],
    ['provider_unavailable', 502, 'market_data_unavailable'],
    ['invalid_response', 502, 'market_data_unavailable'],
    ['empty_response', 404, 'no_market_data'],
    ['invalid_symbol', 422, 'validation_failed'],
  ])('maps %s to HTTP %i with code %s', async (code, status, publicCode) => {
    fetchCandlesMock.mockRejectedValueOnce(new MarketDataError(code as never, 'internal detail'));
    const res = await GET(request());
    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toMatchObject({ error: { code: publicCode } });
  });

  it('never surfaces a provider credential failure as a 401', async () => {
    // A 401 would wrongly tell the user their own session was rejected.
    fetchCandlesMock.mockRejectedValueOnce(new MarketDataError('auth', 'bad key'));
    const res = await GET(request());
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(502);
  });

  it('marks retryable failures so a client can back off', async () => {
    fetchCandlesMock.mockRejectedValueOnce(new MarketDataError('rate_limit', 'x', true));
    await expect((await GET(request())).json()).resolves.toMatchObject({
      error: { retryable: true },
    });
    fetchCandlesMock.mockRejectedValueOnce(new MarketDataError('not_configured', 'x'));
    await expect((await GET(request())).json()).resolves.toMatchObject({
      error: { retryable: false },
    });
  });

  it('maps an unexpected non-MarketDataError to a blank 500', async () => {
    fetchCandlesMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.1:443'));
    const res = await GET(request());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: 'internal' } });
    expect(JSON.stringify(body)).not.toContain('10.0.0.1');
  });
});

describe('response safety', () => {
  it('leaks no secret, header, payload, URL or stack through any failure', async () => {
    const leaky = new MarketDataError(
      'provider_unavailable',
      'Basic ZGItdGVzdC1rZXk6 failed at https://hist.databento.com/v0/timeseries.get_range',
    );
    const cases: unknown[] = [
      leaky,
      new Error('<html>proxy trace</html>'),
      new MarketDataError('invalid_response', 'db-secret-key-value'),
    ];
    for (const err of cases) {
      fetchCandlesMock.mockRejectedValueOnce(err);
      const text = JSON.stringify(await (await GET(request())).json());
      expect(text).not.toContain('Basic ');
      expect(text).not.toContain('hist.databento.com');
      expect(text).not.toContain('db-secret-key-value');
      expect(text).not.toContain('html');
      expect(text).not.toContain('at Object.');
    }
  });

  it('returns only the documented envelope keys on success', async () => {
    const body = (await (await GET(request())).json()) as { data: Record<string, unknown> };
    expect(Object.keys(body)).toEqual(['data']);
    expect(Object.keys(body.data).sort()).toEqual(
      ['candles', 'end', 'provider', 'start', 'symbol', 'timeframe'].sort(),
    );
  });
});

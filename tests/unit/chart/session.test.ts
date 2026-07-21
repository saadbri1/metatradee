import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChartRequestError, loadCandleSession } from '@/features/chart/api';
import {
  CandleSessionPlanError,
  assembleCandleSession,
  oneCalendarMonthAfter,
  planCandleSession,
} from '@/features/chart/session';
import type { Candle } from '@/features/chart/types';

const BASE = {
  symbol: 'ESZ5',
  timeframe: '1m' as const,
  start: '2025-01-01T00:00:00Z',
  end: '2025-01-02T00:00:00Z',
};

function candle(time: number, close = 5_000): Candle {
  return { time, open: close, high: close + 1, low: close - 1, close, volume: 100 };
}

function responseFor(url: string): Response {
  const request = new URL(url, 'http://localhost');
  const start = request.searchParams.get('start')!;
  const end = request.searchParams.get('end')!;
  const time = Date.parse(start) / 1_000;
  return new Response(
    JSON.stringify({
      data: {
        symbol: 'ESZ5',
        timeframe: request.searchParams.get('timeframe'),
        start,
        end,
        provider: 'databento',
        candles: [candle(time)],
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('bounded session planning', () => {
  it.each([
    ['day', '2025-01-02T00:00:00Z', 1],
    ['week', '2025-01-08T00:00:00Z', 3],
    ['one month', '2025-02-01T00:00:00Z', 9],
  ])('plans a %s 1m replay deterministically', (_label, end, expectedChunks) => {
    const request = { ...BASE, end };
    const first = planCandleSession(request);
    const second = planCandleSession(request);
    expect(first).toEqual(second);
    expect(first).toHaveLength(expectedChunks);
    expect(first[0]?.start).toBe(request.start);
    expect(first.at(-1)?.end).toBe(request.end);
    for (let index = 1; index < first.length; index++) {
      expect(first[index - 1]!.end).toBe(first[index]!.start);
    }
  });

  it('uses true calendar-month boundaries including month-end clamping', () => {
    expect(oneCalendarMonthAfter('2025-01-31T12:30:00Z')).toBe('2025-02-28T12:30:00.000Z');
    expect(oneCalendarMonthAfter('2024-01-31T12:30:00Z')).toBe('2024-02-29T12:30:00.000Z');
    expect(() =>
      planCandleSession({ ...BASE, start: '2025-01-31T12:30:00Z', end: '2025-03-01T00:00:00Z' }),
    ).toThrow(CandleSessionPlanError);
  });

  it('aligns derived-timeframe internal boundaries and keeps every chunk under API budgets', () => {
    const chunks = planCandleSession({
      ...BASE,
      timeframe: '15m',
      end: '2025-02-01T00:00:00Z',
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(0, -1)) {
      expect(Date.parse(chunk.end) / 1_000 / 900).toBe(
        Math.trunc(Date.parse(chunk.end) / 1_000 / 900),
      );
      expect((Date.parse(chunk.end) - Date.parse(chunk.start)) / 1_000).toBeLessThanOrEqual(
        600_000,
      );
    }
  });
});

describe('deterministic session assembly', () => {
  it('sorts and deduplicates identical overlap without inventing gaps', () => {
    const a = candle(Date.parse(BASE.start) / 1_000);
    const b = candle(a.time + 60, 5_001);
    const assembled = assembleCandleSession(BASE, [
      { ...BASE, provider: 'databento', candles: [b, a] },
      { ...BASE, provider: 'databento', candles: [b] },
    ]);
    expect(assembled.candles).toEqual([a, b]);
  });

  it('rejects conflicting overlap and out-of-range candles', () => {
    const time = Date.parse(BASE.start) / 1_000;
    expect(() =>
      assembleCandleSession(BASE, [
        { ...BASE, provider: 'databento', candles: [candle(time)] },
        { ...BASE, provider: 'databento', candles: [candle(time, 5_010)] },
      ]),
    ).toThrow(/conflicting prices/i);
    expect(() =>
      assembleCandleSession(BASE, [
        { ...BASE, provider: 'databento', candles: [candle(time - 60)] },
      ]),
    ).toThrow(/outside the requested range/i);
  });
});

describe('initial-load request lifecycle', () => {
  it('loads a month sequentially, assembles it once, and makes no hidden extra calls', async () => {
    let inFlight = 0;
    let maximumInFlight = 0;
    const fetchMock = vi.fn(async (url: string) => {
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      const response = responseFor(url);
      inFlight -= 1;
      return response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = { ...BASE, end: '2025-02-01T00:00:00Z' };
    const result = await loadCandleSession(request);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(maximumInFlight).toBe(1);
    expect(result.start).toBe(request.start);
    expect(result.end).toBe(request.end);
    expect(result.candles).toHaveLength(9);
  });

  it('rejects more than one calendar month before any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadCandleSession({ ...BASE, end: '2025-02-02T00:00:00Z' })).rejects.toMatchObject(
      { code: 'validation_failed' } satisfies Partial<ChartRequestError>,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

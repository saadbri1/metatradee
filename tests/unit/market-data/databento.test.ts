/**
 * Databento pure-core tests: dated-contract validation, provider normalization
 * (1e-9 price scaling, ts_event ns→UTC seconds, malformed rejection), and
 * deterministic 5m/15m aggregation.
 */
import { describe, it, expect } from 'vitest';
import {
  parseDatedContract,
  isDatedContract,
  APPROVED_ROOTS,
  CME_MONTH_CODES,
} from '@/features/market-data/databento/symbols';
import { normalizeRow, normalizeRows } from '@/features/market-data/databento/normalize';
import {
  aggregateCandles,
  toTimeframe,
  bucketStart,
  TIMEFRAME_SECONDS,
  TIMEFRAME_SOURCE,
} from '@/features/market-data/databento/aggregate';
import type { Candle } from '@/features/chart/types';

describe('dated-contract validation (approved policy: dated only)', () => {
  it('accepts valid dated contracts for every approved root', () => {
    for (const sym of ['ESZ5', 'MESZ5', 'NQZ5', 'MNQZ5', 'ESH6', 'NQM7']) {
      expect(isDatedContract(sym), sym).toBe(true);
    }
  });

  it('parses root, month code and year digit', () => {
    expect(parseDatedContract('MESZ5')).toEqual({
      symbol: 'MESZ5',
      root: 'MES',
      monthCode: 'Z',
      yearDigit: '5',
    });
    // Longest-first root ordering: MES must not parse as ES.
    expect(parseDatedContract('MNQH6')?.root).toBe('MNQ');
  });

  it('REJECTS parent symbols — never silently mapped to a contract', () => {
    for (const s of ['ES', 'NQ', 'MES', 'ES.FUT', 'NQ.FUT', 'MES.FUT']) {
      expect(isDatedContract(s), s).toBe(false);
    }
  });

  it('REJECTS continuous symbols (all roll rules)', () => {
    for (const s of ['ES.v.0', 'ES.n.0', 'ES.c.0', 'NQ.v.1', 'MES.c.0']) {
      expect(isDatedContract(s), s).toBe(false);
    }
  });

  it('rejects unsupported roots', () => {
    for (const s of ['CLZ5', 'GCZ5', 'ZBZ5', 'SPZ5', 'RTYZ5']) {
      expect(isDatedContract(s), s).toBe(false);
    }
  });

  it('rejects malformed month codes and expiry years', () => {
    for (const s of ['ESA5', 'ESI5', 'ESL5', 'ESZ', 'ESZ55', 'ES5Z', 'ESZX']) {
      expect(isDatedContract(s), s).toBe(false);
    }
  });

  it('rejects whitespace, case and injection attempts (anchored regex)', () => {
    for (const s of [
      ' ESZ5',
      'ESZ5 ',
      'esz5',
      'ES Z5',
      'ESZ5;DROP',
      "ESZ5'--",
      'ESZ5%20',
      'ESZ5\n',
    ]) {
      expect(isDatedContract(s), JSON.stringify(s)).toBe(false);
    }
  });

  it('rejects non-string input', () => {
    for (const v of [null, undefined, 42, {}, ['ESZ5'], true]) {
      expect(parseDatedContract(v)).toBeNull();
    }
  });

  it('uses the official CME month code set only', () => {
    expect([...CME_MONTH_CODES]).toEqual([
      'F',
      'G',
      'H',
      'J',
      'K',
      'M',
      'N',
      'Q',
      'U',
      'V',
      'X',
      'Z',
    ]);
    expect([...APPROVED_ROOTS].sort()).toEqual(['ES', 'MES', 'MNQ', 'NQ']);
  });
});

describe('provider normalization', () => {
  // 1e9 fixed-point prices; ts_event in UTC nanoseconds.
  const row = {
    ts_event: 1_700_000_000_000_000_000,
    open: 4500_000_000_000,
    high: 4510_000_000_000,
    low: 4495_000_000_000,
    close: 4505_000_000_000,
    volume: 1234,
  };

  it('divides prices by 1e9 (fixed-point) and converts ns → UTC seconds', () => {
    const c = normalizeRow(row)!;
    expect(c.time).toBe(1_700_000_000);
    expect(c.open).toBe(4500);
    expect(c.high).toBe(4510);
    expect(c.low).toBe(4495);
    expect(c.close).toBe(4505);
    expect(c.volume).toBe(1234);
  });

  it('accepts clean numeric strings (64-bit fields may arrive as strings)', () => {
    const c = normalizeRow({ ...row, volume: '99' })!;
    expect(c.volume).toBe(99);
  });

  it('rejects rows with missing or non-numeric fields rather than coercing', () => {
    for (const bad of [
      { ...row, close: undefined },
      { ...row, ts_event: null },
      { ...row, open: 'abc' },
      { ...row, volume: NaN },
      { ...row, high: {} },
    ]) {
      expect(normalizeRow(bad)).toBeNull();
    }
  });

  it('rejects structurally impossible bars', () => {
    // low > high
    expect(normalizeRow({ ...row, low: 9999_000_000_000 })).toBeNull();
    // close outside [low, high]
    expect(normalizeRow({ ...row, close: 1_000_000_000 })).toBeNull();
    // negative volume
    expect(normalizeRow({ ...row, volume: -1 })).toBeNull();
  });

  it('drops malformed rows from a page and sorts the rest by time', () => {
    const out = normalizeRows([
      { ...row, ts_event: 1_700_000_120_000_000_000 },
      { ...row, close: undefined },
      { ...row, ts_event: 1_700_000_060_000_000_000 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!.time).toBeLessThan(out[1]!.time);
  });
});

describe('deterministic 5m / 15m aggregation', () => {
  const t0 = 1_700_000_000 - (1_700_000_000 % 900); // aligned bucket start
  const minute = (i: number, o: number, h: number, l: number, c: number, v: number): Candle => ({
    time: t0 + i * 60,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
  });

  it('buckets on UTC interval starts', () => {
    expect(bucketStart(t0 + 61, 300)).toBe(t0);
    expect(bucketStart(t0 + 301, 300)).toBe(t0 + 300);
    expect(TIMEFRAME_SECONDS['5m']).toBe(300);
    expect(TIMEFRAME_SECONDS['15m']).toBe(900);
  });

  it('open=first, high=max, low=min, close=last, volume=sum', () => {
    const [bar] = aggregateCandles(
      [
        minute(0, 10, 12, 9, 11, 100),
        minute(1, 11, 15, 8, 14, 200),
        minute(2, 14, 14, 13, 13, 300),
      ],
      300,
    );
    expect(bar).toEqual({ time: t0, open: 10, high: 15, low: 8, close: 13, volume: 600 });
  });

  it('is order-independent — a shuffled input yields the identical bar', () => {
    const mins = [
      minute(0, 10, 12, 9, 11, 100),
      minute(1, 11, 15, 8, 14, 200),
      minute(2, 14, 14, 13, 13, 300),
    ];
    expect(aggregateCandles([...mins].reverse(), 300)).toEqual(aggregateCandles(mins, 300));
  });

  it('builds a real bar from partial buckets — never pads or invents candles', () => {
    // Only 2 of 5 minutes present.
    const bars = aggregateCandles([minute(0, 10, 11, 9, 10, 5), minute(3, 10, 20, 10, 19, 7)], 300);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toEqual({ time: t0, open: 10, high: 20, low: 9, close: 19, volume: 12 });
  });

  it('leaves gaps as gaps — no empty bucket is fabricated', () => {
    const bars = aggregateCandles([minute(0, 10, 11, 9, 10, 1), minute(20, 10, 11, 9, 10, 1)], 300);
    expect(bars).toHaveLength(2);
    expect(bars[1]!.time - bars[0]!.time).toBe(1200); // the gap is preserved
  });

  it('does not mutate the input array', () => {
    const mins = [minute(1, 11, 15, 8, 14, 200), minute(0, 10, 12, 9, 11, 100)];
    const before = structuredClone(mins);
    aggregateCandles(mins, 300);
    expect(mins).toEqual(before);
  });

  it('is deterministic across repeated runs', () => {
    const mins = [minute(0, 10, 12, 9, 11, 100), minute(1, 11, 15, 8, 14, 200)];
    expect(aggregateCandles(mins, 900)).toEqual(aggregateCandles(mins, 900));
  });

  it('derives 5m/15m from 1m but passes 1m and 1h through natively', () => {
    expect(TIMEFRAME_SOURCE['1m']).toEqual({ schema: 'ohlcv-1m', derived: false });
    expect(TIMEFRAME_SOURCE['5m']).toEqual({ schema: 'ohlcv-1m', derived: true });
    expect(TIMEFRAME_SOURCE['15m']).toEqual({ schema: 'ohlcv-1m', derived: true });
    expect(TIMEFRAME_SOURCE['1h']).toEqual({ schema: 'ohlcv-1h', derived: false });
    const mins = [minute(0, 10, 12, 9, 11, 100), minute(1, 11, 15, 8, 14, 200)];
    expect(toTimeframe(mins, '1m')).toHaveLength(2); // untouched
    expect(toTimeframe(mins, '5m')).toHaveLength(1); // aggregated
  });

  it('rejects a non-positive interval', () => {
    expect(() => aggregateCandles([minute(0, 1, 1, 1, 1, 1)], 0)).toThrow();
  });
});

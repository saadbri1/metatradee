/**
 * Chart workspace foundation (Phase 12.4).
 *
 * The canvas chart itself is not asserted here — canvas exposes nothing to
 * assertions or assistive tech. What is tested is everything a user or screen
 * reader can actually reach: fixture correctness/determinism, the accessible
 * summary and table, and the explicit states.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  generateFixtureCandles,
  getFixtureSeries,
  summarizeCandles,
  FIXTURE_SEED,
  FIXTURE_SYMBOL,
} from '@/features/chart/fixtures';
import { CandleSummaryPanel, buildSummaryText } from '@/features/chart/components/candle-summary';
import { ChartEmpty, ChartError, ChartLoading } from '@/features/chart/components/states';
import type { Candle } from '@/features/chart/types';

describe('fixture validation', () => {
  it('produces the requested number of candles', () => {
    expect(generateFixtureCandles(50)).toHaveLength(50);
    expect(getFixtureSeries(12).candles).toHaveLength(12);
  });

  it('every candle satisfies low <= min(open,close) <= max(open,close) <= high', () => {
    for (const c of generateFixtureCandles(300)) {
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(c.high);
    }
  });

  it('prices stay positive and volume is a non-negative integer', () => {
    for (const c of generateFixtureCandles(200)) {
      for (const v of [c.open, c.high, c.low, c.close]) expect(v).toBeGreaterThan(0);
      expect(Number.isInteger(c.volume)).toBe(true);
      expect(c.volume).toBeGreaterThanOrEqual(0);
    }
  });

  it('timestamps are strictly increasing and evenly spaced (1h in seconds)', () => {
    const c = generateFixtureCandles(24);
    for (let i = 1; i < c.length; i++) {
      expect(c[i]!.time).toBeGreaterThan(c[i - 1]!.time);
      expect(c[i]!.time - c[i - 1]!.time).toBe(3600);
    }
  });

  it('is deterministic — the same seed yields byte-identical candles', () => {
    expect(generateFixtureCandles(40, FIXTURE_SEED)).toEqual(
      generateFixtureCandles(40, FIXTURE_SEED),
    );
  });

  it('a different seed yields a different series (the PRNG is actually seeded)', () => {
    expect(generateFixtureCandles(40, 1)).not.toEqual(generateFixtureCandles(40, 2));
  });

  it('is labelled as fixture data, never as a real ticker', () => {
    const s = getFixtureSeries(5);
    expect(s.source).toBe('fixture');
    expect(s.symbol).toBe(FIXTURE_SYMBOL);
    expect(s.symbol).toMatch(/DEMO/);
  });
});

describe('no mutation of fixture data', () => {
  it('summarizeCandles does not mutate its input', () => {
    const candles = generateFixtureCandles(30);
    const before = structuredClone(candles);
    summarizeCandles(candles);
    expect(candles).toEqual(before);
  });

  it('each call returns an independent array — mutating one cannot affect another', () => {
    const a = getFixtureSeries(10);
    const b = getFixtureSeries(10);
    a.candles[0]!.close = -999;
    expect(b.candles[0]!.close).not.toBe(-999);
    expect(b.candles).toEqual(getFixtureSeries(10).candles);
  });
});

describe('summary derivation', () => {
  const candles: Candle[] = [
    { time: 100, open: 10, high: 12, low: 9, close: 11, volume: 100 },
    { time: 200, open: 11, high: 15, low: 8, close: 14, volume: 250 },
  ];

  it('computes range, change and volume from the series', () => {
    const s = summarizeCandles(candles);
    expect(s.count).toBe(2);
    expect(s.high).toBe(15);
    expect(s.low).toBe(8);
    expect(s.change).toBe(4); // 14 close - 10 open
    expect(s.changePercent).toBe(40);
    expect(s.totalVolume).toBe(350);
  });

  it('returns a safe empty summary rather than throwing', () => {
    const s = summarizeCandles([]);
    expect(s).toMatchObject({ count: 0, first: null, last: null, high: null, change: null });
    expect(s.totalVolume).toBe(0);
  });
});

describe('accessible summary', () => {
  it('spells out direction in text — never colour alone', () => {
    const up = buildSummaryText(
      summarizeCandles([
        { time: 1, open: 10, high: 11, low: 9, close: 12, volume: 1 },
        { time: 2, open: 12, high: 13, low: 11, close: 13, volume: 1 },
      ]),
      'DEMO/USD',
    );
    expect(up).toContain('up');
    const down = buildSummaryText(
      summarizeCandles([
        { time: 1, open: 20, high: 21, low: 9, close: 15, volume: 1 },
        { time: 2, open: 15, high: 16, low: 10, close: 11, volume: 1 },
      ]),
      'DEMO/USD',
    );
    expect(down).toContain('down');
  });

  it('handles the empty series without inventing values', () => {
    expect(buildSummaryText(summarizeCandles([]), 'DEMO/USD')).toBe(
      'DEMO/USD: no candles to display.',
    );
  });

  it('names the instrument and candle count', () => {
    const text = buildSummaryText(summarizeCandles(generateFixtureCandles(7)), FIXTURE_SYMBOL);
    expect(text).toContain(FIXTURE_SYMBOL);
    expect(text).toContain('7 candles');
  });
});

describe('accessible table fallback', () => {
  const candles = generateFixtureCandles(6);

  it('renders a labelled table with a caption and one row per candle', () => {
    render(
      <CandleSummaryPanel
        candles={candles}
        summary={summarizeCandles(candles)}
        symbol={FIXTURE_SYMBOL}
      />,
    );
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    // 6 data rows + 1 header row
    expect(screen.getAllByRole('row')).toHaveLength(7);
    expect(screen.getByRole('columnheader', { name: /open/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /volume/i })).toBeInTheDocument();
  });

  it('exposes the summary as text, not only as a chart', () => {
    render(
      <CandleSummaryPanel
        candles={candles}
        summary={summarizeCandles(candles)}
        symbol={FIXTURE_SYMBOL}
      />,
    );
    // The symbol appears in both the visible summary and the sr-only table
    // caption — both are intentional, so assert presence rather than uniqueness.
    expect(screen.getAllByText(new RegExp(FIXTURE_SYMBOL)).length).toBeGreaterThan(0);
    expect(screen.getByText(/show candle data table/i)).toBeInTheDocument();
  });
});

describe('explicit states', () => {
  it('empty state explains itself without fake data', () => {
    render(<ChartEmpty />);
    expect(screen.getByText(/no candles to display/i)).toBeInTheDocument();
  });

  it('error state is announced to assistive tech', () => {
    render(<ChartError message="Series unavailable." />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/series unavailable/i)).toBeInTheDocument();
  });

  it('loading state is a polite live region', () => {
    render(<ChartLoading />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/loading chart/i);
  });
});

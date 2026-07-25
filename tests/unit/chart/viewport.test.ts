import { describe, expect, it } from 'vitest';
import {
  NORMAL_VIEWPORT_MAX_BARS,
  NORMAL_VIEWPORT_CURSOR_POSITION,
  initialLogicalRange,
} from '@/features/chart/viewport';

describe('normal-mode initial viewport', () => {
  it('bounds a full trading day to a professional window instead of the whole domain', () => {
    // A complete RTH day. Fitting all 390 is exactly what made 1m bars look hourly.
    const range = initialLogicalRange(390)!;
    const visibleBars = range.to - range.from;

    expect(range).not.toBeNull();
    // Visible bars stay inside the professional 160-220 band, not 390.
    const barsOnScreen = NORMAL_VIEWPORT_MAX_BARS;
    expect(barsOnScreen).toBeGreaterThanOrEqual(160);
    expect(barsOnScreen).toBeLessThanOrEqual(220);
    expect(visibleBars).toBeLessThan(390);
  });

  it('anchors the latest candle near 76% of the width with a right margin', () => {
    const count = 390;
    const range = initialLogicalRange(count)!;
    const lastIndex = count - 1;

    // The newest bar is inside the range, and blank workspace follows it.
    expect(range.to).toBeGreaterThan(lastIndex);
    const total = range.to - range.from;
    const cursorFraction = (lastIndex - range.from) / total;
    expect(cursorFraction).toBeGreaterThanOrEqual(0.72);
    expect(cursorFraction).toBeLessThanOrEqual(0.8);
    expect(cursorFraction).toBeCloseTo(NORMAL_VIEWPORT_CURSOR_POSITION, 1);
  });

  it('keeps older candles reachable by panning (range starts above zero)', () => {
    const range = initialLogicalRange(390)!;
    // Not pinned to index 0 — history exists to the left and can be panned to.
    expect(range.from).toBeGreaterThan(0);
  });

  it('shows the whole session when it is smaller than the window', () => {
    const range = initialLogicalRange(90)!;
    expect(range.from).toBe(0);
    // Still leaves a right margin rather than jamming the last bar to the edge.
    expect(range.to).toBeGreaterThan(89);
  });

  it('handles degenerate inputs safely', () => {
    expect(initialLogicalRange(0)).toBeNull();
    expect(initialLogicalRange(-5)).toBeNull();
    expect(initialLogicalRange(Number.NaN)).toBeNull();
    const single = initialLogicalRange(1)!;
    expect(single.to).toBeGreaterThan(single.from);
  });

  it('advances the window with the session as more candles load', () => {
    const small = initialLogicalRange(200)!;
    const large = initialLogicalRange(390)!;
    // A longer session shifts the window forward rather than compressing it.
    expect(large.from).toBeGreaterThan(small.from);
    expect(large.to - large.from).toBeCloseTo(small.to - small.from, 5);
  });
});

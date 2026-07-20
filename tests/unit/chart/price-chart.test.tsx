/**
 * PriceChart vendor-boundary contract (Phase 1 — chart polish).
 *
 * The charting vendor cannot run under jsdom (no canvas), so the module is
 * mocked and the assertions target the CONTRACT this adapter must honour:
 * one chart instance reused across data updates, volume isolated on its own
 * scale, deterministic framing (fitContent vs sparse bar spacing), the
 * attribution option, the hover legend, and the watermark.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Candle } from '@/features/chart/types';

type SeriesMock = {
  setData: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  applyOptions: ReturnType<typeof vi.fn>;
  createPriceLine: ReturnType<typeof vi.fn>;
  removePriceLine: ReturnType<typeof vi.fn>;
  __kind: string;
  __options: Record<string, unknown>;
};

type ChartMock = {
  addSeries: ReturnType<typeof vi.fn>;
  applyOptions: ReturnType<typeof vi.fn>;
  priceScale: ReturnType<typeof vi.fn>;
  timeScale: ReturnType<typeof vi.fn>;
  subscribeCrosshairMove: ReturnType<typeof vi.fn>;
  unsubscribeCrosshairMove: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  __options: Record<string, unknown>;
  __series: SeriesMock[];
  __priceScales: Map<string, { applyOptions: ReturnType<typeof vi.fn> }>;
  __timeScale: {
    fitContent: ReturnType<typeof vi.fn>;
    applyOptions: ReturnType<typeof vi.fn>;
    scrollToRealTime: ReturnType<typeof vi.fn>;
  };
  __crosshairCb: ((param: unknown) => void) | null;
};

const charts = vi.hoisted(() => [] as ChartMock[]);
const markerPlugins = vi.hoisted(
  () => [] as Array<{ setMarkers: ReturnType<typeof vi.fn>; detach: ReturnType<typeof vi.fn> }>,
);

vi.mock('lightweight-charts', () => {
  const CandlestickSeries = { kind: 'Candlestick' };
  const HistogramSeries = { kind: 'Histogram' };
  return {
    CandlestickSeries,
    HistogramSeries,
    createSeriesMarkers: vi.fn(() => {
      const plugin = { setMarkers: vi.fn(), detach: vi.fn() };
      markerPlugins.push(plugin);
      return plugin;
    }),
    createChart: vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
      const timeScale = {
        fitContent: vi.fn(),
        applyOptions: vi.fn(),
        scrollToRealTime: vi.fn(),
      };
      const priceScales = new Map<string, { applyOptions: ReturnType<typeof vi.fn> }>();
      const chart: ChartMock = {
        __options: options,
        __series: [],
        __priceScales: priceScales,
        __timeScale: timeScale,
        __crosshairCb: null,
        applyOptions: vi.fn(),
        addSeries: vi.fn((type: { kind: string }, seriesOptions: Record<string, unknown>) => {
          const series: SeriesMock = {
            setData: vi.fn(),
            update: vi.fn(),
            applyOptions: vi.fn(),
            createPriceLine: vi.fn((options) => ({ options })),
            removePriceLine: vi.fn(),
            __kind: type.kind,
            __options: seriesOptions,
          };
          chart.__series.push(series);
          return series;
        }),
        priceScale: vi.fn((id: string) => {
          if (!priceScales.has(id)) priceScales.set(id, { applyOptions: vi.fn() });
          return priceScales.get(id)!;
        }),
        timeScale: vi.fn(() => timeScale),
        subscribeCrosshairMove: vi.fn((cb: (param: unknown) => void) => {
          chart.__crosshairCb = cb;
        }),
        unsubscribeCrosshairMove: vi.fn(),
        remove: vi.fn(),
      };
      charts.push(chart);
      return chart;
    }),
  };
});

import { PriceChart } from '@/features/chart/components/price-chart';
import { LightweightChartProvider } from '@/features/chart/provider/lightweight-chart-provider';

function bar(i: number, close = 4120 + i): Candle {
  return {
    time: 1654548600 + i * 60,
    open: 4120,
    high: Math.max(4121, close + 1),
    low: 4119,
    close,
    volume: 100 + i,
  };
}

const SPARSE = Array.from({ length: 5 }, (_, i) => bar(i));
const DENSE = Array.from({ length: 200 }, (_, i) => bar(i));

const lastChart = () => charts[charts.length - 1]!;
const candleSeries = () => lastChart().__series.find((s) => s.__kind === 'Candlestick')!;
const volumeSeries = () => lastChart().__series.find((s) => s.__kind === 'Histogram')!;

beforeEach(() => {
  charts.length = 0;
  markerPlugins.length = 0;
});

describe('chart lifecycle', () => {
  it('creates the chart once and feeds data updates into the same instance', () => {
    const { rerender } = render(<PriceChart candles={DENSE} />);
    expect(charts).toHaveLength(1);
    expect(candleSeries().setData).toHaveBeenCalledTimes(1);

    rerender(<PriceChart candles={[...DENSE, bar(200)]} />);
    // Still ONE chart — data flowed through setData, no teardown/recreate.
    expect(charts).toHaveLength(1);
    expect(candleSeries().setData).toHaveBeenCalledTimes(2);
    expect(lastChart().remove).not.toHaveBeenCalled();
  });

  it('keeps the required TradingView attribution enabled', () => {
    render(<PriceChart candles={DENSE} />);
    const layout = lastChart().__options.layout as { attributionLogo: boolean };
    expect(layout.attributionLogo).toBe(true);
  });

  it('configures proportional price-scale margins, never a hard-coded range', () => {
    render(<PriceChart candles={DENSE} />);
    const scale = lastChart().__options.rightPriceScale as {
      scaleMargins: { top: number; bottom: number };
    };
    expect(scale.scaleMargins.top).toBeGreaterThan(0);
    expect(scale.scaleMargins.bottom).toBeGreaterThan(scale.scaleMargins.top);
    expect(JSON.stringify(lastChart().__options)).not.toMatch(/minValue|maxValue/);
  });
});

describe('volume isolation', () => {
  it('puts volume on its own scale id, excluded from candlestick autoscaling', () => {
    render(<PriceChart candles={DENSE} />);
    expect(volumeSeries().__options.priceScaleId).toBe('volume');
    // The candlestick series must NOT name the volume scale (default = right).
    expect(candleSeries().__options.priceScaleId).toBeUndefined();
  });

  it('confines volume to a bottom band via its own scale margins', () => {
    render(<PriceChart candles={DENSE} />);
    const volScale = lastChart().__priceScales.get('volume')!;
    expect(volScale.applyOptions).toHaveBeenCalledWith({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
  });

  it('silences volume chrome (no last-value label, no price line)', () => {
    render(<PriceChart candles={DENSE} />);
    expect(volumeSeries().__options.lastValueVisible).toBe(false);
    expect(volumeSeries().__options.priceLineVisible).toBe(false);
  });

  it('toggles the real volume series visibility', () => {
    const { rerender } = render(<PriceChart candles={DENSE} volumeVisible />);
    rerender(<PriceChart candles={DENSE} volumeVisible={false} />);
    expect(volumeSeries().applyOptions).toHaveBeenLastCalledWith({ visible: false });
  });
});

describe('framing', () => {
  it('runs fitContent after every dense data update', () => {
    const { rerender } = render(<PriceChart candles={DENSE} />);
    expect(lastChart().__timeScale.fitContent).toHaveBeenCalledTimes(1);
    rerender(<PriceChart candles={[...DENSE, bar(200)]} />);
    expect(lastChart().__timeScale.fitContent).toHaveBeenCalledTimes(2);
  });

  it('frames sparse series with fixed bar spacing instead of stretching them', () => {
    render(<PriceChart candles={SPARSE} />);
    expect(lastChart().__timeScale.fitContent).not.toHaveBeenCalled();
    expect(lastChart().__timeScale.applyOptions).toHaveBeenCalledWith(
      expect.objectContaining({ barSpacing: expect.any(Number) }),
    );
    expect(lastChart().__timeScale.scrollToRealTime).toHaveBeenCalled();
  });

  it('switches framing modes when density crosses the threshold', () => {
    const { rerender } = render(<PriceChart candles={SPARSE} />);
    expect(lastChart().__timeScale.fitContent).not.toHaveBeenCalled();
    rerender(<PriceChart candles={DENSE} />);
    expect(lastChart().__timeScale.fitContent).toHaveBeenCalledTimes(1);
  });
});

describe('price-scale lock', () => {
  it('disables autoscale when locked and re-enables it when unlocked', () => {
    const { rerender } = render(<PriceChart candles={DENSE} priceScaleLocked={false} />);
    const rightScale = lastChart().__priceScales.get('right')!;
    expect(rightScale.applyOptions).toHaveBeenLastCalledWith({ autoScale: true });

    rerender(<PriceChart candles={DENSE} priceScaleLocked />);
    expect(rightScale.applyOptions).toHaveBeenLastCalledWith({ autoScale: false });

    rerender(<PriceChart candles={DENSE} priceScaleLocked={false} />);
    expect(rightScale.applyOptions).toHaveBeenLastCalledWith({ autoScale: true });
  });

  it('never pins hard-coded min/max price values', () => {
    render(<PriceChart candles={DENSE} priceScaleLocked />);
    const rightScale = lastChart().__priceScales.get('right')!;
    for (const call of rightScale.applyOptions.mock.calls) {
      expect(JSON.stringify(call[0])).not.toMatch(/minValue|maxValue|priceRange/);
    }
  });

  it('skips re-framing on data updates while locked — the held view must not move', () => {
    const { rerender } = render(<PriceChart candles={DENSE} priceScaleLocked />);
    const fits = lastChart().__timeScale.fitContent.mock.calls.length;
    rerender(<PriceChart candles={[...DENSE, bar(200)]} priceScaleLocked />);
    // Data still flowed…
    expect(candleSeries().setData).toHaveBeenCalledTimes(2);
    // …but no fitContent and no sparse re-spacing happened.
    expect(lastChart().__timeScale.fitContent.mock.calls.length).toBe(fits);
  });

  it('also skips sparse re-spacing while locked', () => {
    const { rerender } = render(<PriceChart candles={SPARSE} priceScaleLocked />);
    const spacingCalls = lastChart().__timeScale.applyOptions.mock.calls.length;
    rerender(<PriceChart candles={[...SPARSE, bar(5)]} priceScaleLocked />);
    expect(lastChart().__timeScale.applyOptions.mock.calls.length).toBe(spacingCalls);
  });

  it('resumes normal framing after unlock on the next data update', () => {
    const { rerender } = render(<PriceChart candles={DENSE} priceScaleLocked />);
    rerender(<PriceChart candles={DENSE} priceScaleLocked={false} />);
    rerender(<PriceChart candles={[...DENSE, bar(200)]} priceScaleLocked={false} />);
    expect(lastChart().__timeScale.fitContent.mock.calls.length).toBeGreaterThan(0);
  });
});

describe('explicit fit request', () => {
  it('fits content once per increment, even while the price scale is locked', () => {
    const { rerender } = render(<PriceChart candles={DENSE} priceScaleLocked fitRequest={0} />);
    const before = lastChart().__timeScale.fitContent.mock.calls.length;
    rerender(<PriceChart candles={DENSE} priceScaleLocked fitRequest={1} />);
    expect(lastChart().__timeScale.fitContent.mock.calls.length).toBe(before + 1);
    rerender(<PriceChart candles={DENSE} priceScaleLocked fitRequest={2} />);
    expect(lastChart().__timeScale.fitContent.mock.calls.length).toBe(before + 2);
  });

  it('does not fit on mount for the initial zero value', () => {
    render(<PriceChart candles={SPARSE} fitRequest={0} />);
    // Sparse mount performs no fitContent; fitRequest=0 must not add one.
    expect(lastChart().__timeScale.fitContent).not.toHaveBeenCalled();
  });
});

describe('simulated-order annotations', () => {
  it('uses supported price-line and series-marker APIs', () => {
    const { rerender } = render(
      <PriceChart
        candles={SPARSE}
        orderLines={[
          { id: 'entry', price: 4120, role: 'entry', side: 'buy', label: 'Buy limit' },
          { id: 'stop', price: 4119, role: 'stop_loss', side: 'sell', label: 'Stop loss' },
        ]}
        fillMarkers={[
          {
            id: 'entry:fill',
            time: SPARSE[1]!.time,
            price: 4120,
            side: 'buy',
            kind: 'entry_fill',
            label: 'Buy entry 1 @ 4120',
          },
        ]}
      />,
    );
    expect(candleSeries().createPriceLine).toHaveBeenCalledTimes(2);
    expect(candleSeries().createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({ price: 4119, title: 'Stop loss', axisLabelVisible: true }),
    );
    const marker = markerPlugins[0]!.setMarkers.mock.calls.at(-1)?.[0]?.[0];
    expect(marker).toMatchObject({ time: SPARSE[1]!.time, shape: 'arrowUp' });
    expect(marker.text).toMatch(/Buy entry/);

    rerender(<PriceChart candles={SPARSE} orderLines={[]} fillMarkers={[]} />);
    expect(candleSeries().removePriceLine).toHaveBeenCalledTimes(2);
    expect(markerPlugins[0]!.setMarkers).toHaveBeenLastCalledWith([]);
  });

  it('hides and restores both lines and markers through one working toggle', () => {
    const lines = [
      { id: 'entry', price: 4120, role: 'entry' as const, side: 'buy' as const, label: 'Buy' },
    ];
    const markers = [
      {
        id: 'fill',
        time: SPARSE[1]!.time,
        price: 4120,
        side: 'buy' as const,
        kind: 'entry_fill' as const,
        label: 'Buy fill',
      },
    ];
    const { rerender } = render(
      <PriceChart candles={SPARSE} orderLines={lines} fillMarkers={markers} />,
    );
    rerender(
      <PriceChart
        candles={SPARSE}
        orderLines={lines}
        fillMarkers={markers}
        orderAnnotationsVisible={false}
      />,
    );
    expect(candleSeries().removePriceLine).toHaveBeenCalled();
    expect(markerPlugins[0]!.setMarkers).toHaveBeenLastCalledWith([]);

    rerender(
      <PriceChart
        candles={SPARSE}
        orderLines={lines}
        fillMarkers={markers}
        orderAnnotationsVisible
      />,
    );
    expect(candleSeries().createPriceLine.mock.calls.length).toBeGreaterThan(1);
    expect(markerPlugins[0]!.setMarkers).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'fill' }),
    ]);
  });
});

describe('Lightweight adapter contract', () => {
  it('updates one candle and cleans up vendor subscriptions on destroy', () => {
    const wrapper = document.createElement('div');
    const container = document.createElement('div');
    wrapper.append(container);
    document.body.append(wrapper);
    const provider = new LightweightChartProvider();
    provider.initialize(container);
    const subscriber = vi.fn();
    const unsubscribe = provider.subscribeCrosshair(subscriber);

    provider.updateCandle(SPARSE[1]!);
    expect(candleSeries().update).toHaveBeenCalledWith(
      expect.objectContaining({ time: SPARSE[1]!.time, close: SPARSE[1]!.close }),
    );
    expect(volumeSeries().update).toHaveBeenCalledWith(
      expect.objectContaining({ time: SPARSE[1]!.time, value: SPARSE[1]!.volume }),
    );

    act(() => {
      lastChart().__crosshairCb!({
        time: SPARSE[1]!.time,
        seriesData: new Map<unknown, unknown>([
          [candleSeries(), SPARSE[1]],
          [volumeSeries(), { value: SPARSE[1]!.volume }],
        ]),
      });
    });
    expect(subscriber).toHaveBeenCalledWith(SPARSE[1]);
    unsubscribe();
    provider.destroy();
    expect(lastChart().unsubscribeCrosshairMove).toHaveBeenCalledOnce();
    expect(markerPlugins[0]!.detach).toHaveBeenCalledOnce();
    expect(lastChart().remove).toHaveBeenCalledOnce();
    expect(wrapper.querySelector('[data-testid="chart-watermark"]')).toBeNull();
    wrapper.remove();
  });
});

describe('OHLCV legend', () => {
  it('shows the most recent bar by default', () => {
    render(<PriceChart candles={SPARSE} />);
    const legend = screen.getByTestId('chart-legend');
    const last = SPARSE[SPARSE.length - 1]!;
    expect(legend).toHaveTextContent(
      `C ${last.close.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    );
    expect(legend).toHaveTextContent(`Vol ${last.volume.toLocaleString('en-US')}`);
  });

  it('updates from crosshair data and reverts when the pointer leaves', () => {
    render(<PriceChart candles={SPARSE} />);
    const chart = lastChart();
    const hoveredBar = { open: 4100, high: 4200, low: 4050, close: 4150 };

    act(() => {
      chart.__crosshairCb!({
        time: SPARSE[1]!.time,
        seriesData: new Map<unknown, unknown>([
          [candleSeries(), hoveredBar],
          [volumeSeries(), { value: 777 }],
        ]),
      });
    });
    const legend = screen.getByTestId('chart-legend');
    expect(legend).toHaveTextContent('C 4,150.00');
    expect(legend).toHaveTextContent('Vol 777');

    act(() => {
      chart.__crosshairCb!({ time: undefined, seriesData: new Map() });
    });
    // Back to the latest bar, never a stale hover.
    expect(screen.getByTestId('chart-legend')).toHaveTextContent(
      `Vol ${SPARSE[SPARSE.length - 1]!.volume.toLocaleString('en-US')}`,
    );
  });

  it('renders no legend for an empty series', () => {
    render(<PriceChart candles={[]} />);
    expect(screen.queryByTestId('chart-legend')).not.toBeInTheDocument();
  });
});

describe('watermark', () => {
  it('renders the identity watermark when provided', () => {
    render(<PriceChart candles={SPARSE} watermark="ESM2 · 1m" />);
    expect(screen.getByTestId('chart-watermark')).toHaveTextContent('ESM2 · 1m');
  });

  it('renders no watermark element when absent', () => {
    render(<PriceChart candles={SPARSE} />);
    expect(screen.getByTestId('chart-watermark')).not.toBeVisible();
  });
});

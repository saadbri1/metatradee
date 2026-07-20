'use client';

/**
 * The ONLY module in this repository that imports the charting vendor.
 *
 * Per docs/PROJECT_STRUCTURE.md rule 5, domain code never imports a vendor SDK.
 * Everything outside this file speaks in `Candle` (features/chart/types.ts), so
 * the library can be swapped or removed without touching domain logic or the
 * accessible alternatives.
 *
 * ATTRIBUTION (required — lightweight-charts is Apache-2.0, © 2023 TradingView):
 * the licence requires naming TradingView as the creator and surfacing a link to
 * tradingview.com. `layout.attributionLogo` is left at its default `true`, which
 * renders the in-chart link the vendor documents as satisfying that requirement.
 * It must not be disabled. A visible text credit is additionally rendered by
 * `chart-workspace.tsx`.
 *
 * RENDERING DISCIPLINE: the chart instance is created ONCE and reused; new data
 * flows through `setData` on the existing series. Recreating the chart per load
 * (the previous behaviour) destroyed the user's scale state and flickered the
 * whole surface on every request.
 *
 * Canvas is invisible to assistive technology, so this component is
 * `aria-hidden` and the real accessible content lives in `candle-summary.tsx`
 * (text summary + data table) — mirroring the contract already used by
 * `features/analytics/components/equity-chart.tsx`. The hover legend below is
 * likewise supplementary: a crosshair is pointer-driven, so its data reaches
 * assistive tech through the table, not by announcing 60 Hz mouse moves.
 */
import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import type { Candle } from '../types';

/**
 * Below this bar count, `fitContent()` would stretch a handful of candles into
 * grotesque slabs. Sparse series get a fixed, readable bar width instead and
 * sit against the right edge with a small offset, framed like a real terminal.
 */
const SPARSE_BAR_THRESHOLD = 60;
const SPARSE_BAR_SPACING = 14;
/** Breathing room (in bars) between the last candle and the right edge. */
const RIGHT_OFFSET_BARS = 3;

/** Read a CSS custom property so the chart uses design tokens, never hex. */
function tokenColor(el: HTMLElement, name: string, alpha?: number): string {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return 'transparent';
  return alpha === undefined ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBarTime(seconds: number): string {
  return `${new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * The OHLCV hover legend, overlaid top-left like a terminal readout. Follows
 * the crosshair and falls back to the most recent bar. Direction is conveyed
 * by the value colour AND the signed change figure — never colour alone.
 */
function ChartLegend({ candle }: { candle: Candle | null }) {
  if (!candle) return null;
  const up = candle.close >= candle.open;
  const change = candle.close - candle.open;
  const valueClass = up ? 'text-profit' : 'text-loss';
  const cells: Array<[string, string]> = [
    ['O', formatPrice(candle.open)],
    ['H', formatPrice(candle.high)],
    ['L', formatPrice(candle.low)],
    ['C', formatPrice(candle.close)],
  ];
  return (
    <div
      data-testid="chart-legend"
      className="pointer-events-none absolute left-3 top-2 z-10 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs"
    >
      <span className="tabular text-muted-foreground">{formatBarTime(candle.time)}</span>
      {cells.map(([label, value]) => (
        <span key={label} className="tabular">
          <span className="text-muted-foreground">{label} </span>
          <span className={valueClass}>{value}</span>
        </span>
      ))}
      <span className={`tabular ${valueClass}`}>
        {change >= 0 ? '+' : '−'}
        {formatPrice(Math.abs(change))}
      </span>
      <span className="tabular">
        <span className="text-muted-foreground">Vol </span>
        <span className="text-foreground">{candle.volume.toLocaleString('en-US')}</span>
      </span>
    </div>
  );
}

export function PriceChart({
  candles,
  height = 460,
  watermark,
  priceScaleLocked = false,
  fitRequest = 0,
}: {
  candles: Candle[];
  height?: number;
  /** e.g. "ESM2 · 1m" — rendered as a faint identity mark behind the candles. */
  watermark?: string;
  /**
   * Locked = the price scale stops autoscaling (`autoScale: false`), so the
   * range the user is looking at survives data updates. No min/max is ever
   * pinned — the vendor keeps its own current range, which is the only way to
   * "hold" a scale without hard-coding prices.
   */
  priceScaleLocked?: boolean;
  /** Monotonic counter; each increment requests one `fitContent()`. */
  fitRequest?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState<Candle | null>(null);
  // Mirror for effect B, so a lock change doesn't force a data-refeed and a
  // data update can consult the CURRENT lock without re-running on lock flips.
  const lockedRef = useRef(priceScaleLocked);

  // Effect A — create the chart exactly once per mount/height. Data changes
  // must NOT tear the instance down; feeding data is effect B's job.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let chart: IChartApi | null = null;
    try {
      const border = tokenColor(el, '--border');
      chart = createChart(el, {
        height,
        // Native responsive resizing — no manual ResizeObserver needed.
        autoSize: true,
        layout: {
          background: { color: 'transparent' },
          textColor: tokenColor(el, '--muted-foreground'),
          fontSize: 11,
          // Inherit the app's type instead of the vendor default stack.
          fontFamily: getComputedStyle(el).fontFamily || undefined,
          // REQUIRED ATTRIBUTION — do not set to false.
          attributionLogo: true,
        },
        grid: {
          // Quiet grid: visible on inspection, silent at reading distance.
          vertLines: { color: tokenColor(el, '--border', 0.25) },
          horzLines: { color: tokenColor(el, '--border', 0.25) },
        },
        crosshair: {
          mode: 0, // free crosshair
          vertLine: {
            color: tokenColor(el, '--muted-foreground', 0.5),
            labelBackgroundColor: tokenColor(el, '--muted'),
          },
          horzLine: {
            color: tokenColor(el, '--muted-foreground', 0.5),
            labelBackgroundColor: tokenColor(el, '--muted'),
          },
        },
        rightPriceScale: {
          borderColor: border,
          borderVisible: false,
          // Keep candles clear of the volume band and the pane edges without
          // hard-coding any price range — margins are proportional.
          scaleMargins: { top: 0.08, bottom: 0.28 },
        },
        timeScale: {
          borderColor: border,
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: RIGHT_OFFSET_BARS,
        },
        // Pan + zoom.
        handleScroll: true,
        handleScale: true,
      });

      // --profit / --loss are reserved P&L semantics (tokens.css) — correct here.
      const up = tokenColor(el, '--profit');
      const down = tokenColor(el, '--loss');

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
        priceLineVisible: true,
        priceLineColor: tokenColor(el, '--muted-foreground', 0.5),
      });

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        // Its own scale id — volume must never contaminate price autoscaling.
        priceScaleId: 'volume',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      // Volume lives in a bottom band, mirrored by the price scale's bottom
      // margin above, so bars never overlap candles.
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

      chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
        if (!param.time || !candleSeriesRef.current) {
          setHovered(null);
          return;
        }
        const bar = param.seriesData.get(candleSeriesRef.current) as
          { open: number; high: number; low: number; close: number } | undefined;
        if (!bar) {
          setHovered(null);
          return;
        }
        const vol = volumeSeriesRef.current
          ? (param.seriesData.get(volumeSeriesRef.current) as { value: number } | undefined)
          : undefined;
        setHovered({
          time: param.time as number,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: vol?.value ?? 0,
        });
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
    } catch {
      // A vendor failure must degrade to the accessible alternative, not crash
      // the route. The summary + table below remain fully usable.
      setFailed(true);
    }

    return () => {
      chart?.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]);

  // Lock sync — declared BEFORE effect B so that on a simultaneous lock+data
  // change the scale mode is settled before new data is framed.
  useEffect(() => {
    lockedRef.current = priceScaleLocked;
    try {
      chartRef.current?.priceScale('right').applyOptions({ autoScale: !priceScaleLocked });
    } catch {
      // A scale-option failure is cosmetic; never take the chart down for it.
    }
  }, [priceScaleLocked]);

  // Explicit fit request (keyboard `F` / toolbar). Time-axis only, so it works
  // while the price scale is locked without disturbing the held range.
  useEffect(() => {
    if (fitRequest > 0) {
      try {
        chartRef.current?.timeScale().fitContent();
      } catch {
        // Same policy: framing is best-effort.
      }
    }
  }, [fitRequest]);

  // Effect B — feed data into the existing instance, then frame it.
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const el = containerRef.current;
    if (!chart || !candleSeries || !volumeSeries || !el) return;

    try {
      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
      volumeSeries.setData(
        candles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color:
            c.close >= c.open ? tokenColor(el, '--profit', 0.4) : tokenColor(el, '--loss', 0.4),
        })),
      );

      // Framing: dense series fill the pane; sparse series get a fixed,
      // readable bar width instead of being stretched wall-to-wall. While the
      // price scale is locked, skip re-framing entirely — the user asked the
      // view to hold still, and data updates must not move it.
      if (lockedRef.current) return;
      if (candles.length > 0 && candles.length <= SPARSE_BAR_THRESHOLD) {
        chart.timeScale().applyOptions({
          barSpacing: SPARSE_BAR_SPACING,
          rightOffset: RIGHT_OFFSET_BARS,
        });
        chart.timeScale().scrollToRealTime();
      } else {
        chart.timeScale().fitContent();
      }
    } catch {
      setFailed(true);
    }
  }, [candles]);

  if (failed) {
    return (
      <div
        role="status"
        className="flex items-center justify-center rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground"
        style={{ height }}
      >
        The interactive chart could not be rendered. The data table below still shows every candle.
      </div>
    );
  }

  const lastCandle = candles.length > 0 ? candles[candles.length - 1]! : null;

  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden rounded-lg border border-border bg-card"
      style={{ height }}
    >
      {/*
        Identity watermark. Pure DOM behind the canvas: the chart background is
        transparent, so this shows through without touching the vendor API.
      */}
      {watermark ? (
        <div
          data-testid="chart-watermark"
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center"
        >
          <span className="font-display text-5xl font-semibold tracking-tight text-muted-foreground/10">
            {watermark}
          </span>
        </div>
      ) : null}
      <ChartLegend candle={hovered ?? lastCandle} />
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}

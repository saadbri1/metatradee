'use client';

/**
 * The ONLY module in this repository that imports the charting vendor.
 *
 * Per docs/PROJECT_STRUCTURE.md rule 5, domain code never imports a vendor SDK.
 * Everything outside this file speaks in `Candle` (features/chart/types.ts), so
 * the library can be swapped or removed without touching domain logic, fixtures,
 * or the accessible alternatives.
 *
 * ATTRIBUTION (required — lightweight-charts is Apache-2.0, © 2023 TradingView):
 * the licence requires naming TradingView as the creator and surfacing a link to
 * tradingview.com. `layout.attributionLogo` is left at its default `true`, which
 * renders the in-chart link the vendor documents as satisfying that requirement.
 * It must not be disabled. A visible text credit is additionally rendered by
 * `chart-workspace.tsx`.
 *
 * Canvas is invisible to assistive technology, so this component is
 * `aria-hidden` and the real accessible content lives in `candle-summary.tsx`
 * (text summary + data table) — mirroring the contract already used by
 * `features/analytics/components/equity-chart.tsx`.
 */
import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type Time,
} from 'lightweight-charts';
import type { Candle } from '../types';

/** Read a CSS custom property so the chart uses design tokens, never hex. */
function tokenColor(el: HTMLElement, name: string, alpha?: number): string {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return 'transparent';
  return alpha === undefined ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

export function PriceChart({ candles, height = 460 }: { candles: Candle[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let chart: IChartApi | null = null;
    try {
      chart = createChart(el, {
        height,
        // Native responsive resizing — no manual ResizeObserver needed.
        autoSize: true,
        layout: {
          background: { color: 'transparent' },
          textColor: tokenColor(el, '--muted-foreground'),
          // REQUIRED ATTRIBUTION — do not set to false.
          attributionLogo: true,
        },
        grid: {
          vertLines: { color: tokenColor(el, '--border', 0.4) },
          horzLines: { color: tokenColor(el, '--border', 0.4) },
        },
        crosshair: { mode: 0 }, // free crosshair
        rightPriceScale: { borderColor: tokenColor(el, '--border') },
        timeScale: { borderColor: tokenColor(el, '--border'), timeVisible: true },
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
      });
      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      // Keep volume in a bottom band so it never obscures price.
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volumeSeries.setData(
        candles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color:
            c.close >= c.open ? tokenColor(el, '--profit', 0.5) : tokenColor(el, '--loss', 0.5),
        })),
      );

      chart.timeScale().fitContent();
      chartRef.current = chart;
    } catch {
      // A vendor failure must degrade to the accessible alternative, not crash
      // the route. The summary + table below remain fully usable.
      setFailed(true);
    }

    return () => {
      chart?.remove();
      chartRef.current = null;
    };
  }, [candles, height]);

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

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="w-full overflow-hidden rounded-lg border border-border bg-card"
      style={{ height }}
    />
  );
}

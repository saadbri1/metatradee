'use client';

/**
 * React lifecycle wrapper around the provider-neutral chart contract.
 * Renderer-specific calls live in `provider/lightweight-chart-provider.ts`.
 */
import { useEffect, useRef, useState } from 'react';
import type { Candle } from '../types';
import {
  createLightweightChartProvider,
  type ChartCrosshairMode,
  type ChartMarker,
  type ChartOrderLine,
  type ChartProvider,
  type ChartProviderFactory,
} from '../provider';

const NO_ORDER_LINES: readonly ChartOrderLine[] = [];
const NO_FILL_MARKERS: readonly ChartMarker[] = [];

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBarTime(seconds: number): string {
  return `${new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function ChartLegend({ candle }: { candle: Candle | null }) {
  if (!candle) return null;
  const up = candle.close >= candle.open;
  const change = candle.close - candle.open;
  const cells: Array<[string, string]> = [
    ['O', formatPrice(candle.open)],
    ['H', formatPrice(candle.high)],
    ['L', formatPrice(candle.low)],
    ['C', formatPrice(candle.close)],
  ];
  return (
    <div
      data-testid="chart-legend"
      data-direction={up ? 'up' : 'down'}
      className="pointer-events-none absolute left-3 top-2 z-20 max-w-[calc(100%-1.5rem)] border border-border/80 bg-background/85 px-2.5 py-1.5 text-[10px] shadow-lg shadow-background/30 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 border-b border-border/60 pb-1">
        <span className="tabular text-muted-foreground">{formatBarTime(candle.time)}</span>
        <span className="ml-auto font-medium text-foreground">{up ? 'Up bar' : 'Down bar'}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {cells.map(([label, value]) => (
          <span key={label} className="tabular">
            <span className="text-muted-foreground">{label} </span>
            <span className="font-medium text-foreground">{value}</span>
          </span>
        ))}
        <span className="tabular border-l border-border pl-2 font-medium text-foreground">
          {change >= 0 ? '+' : '−'}
          {formatPrice(Math.abs(change))}
        </span>
        <span className="tabular">
          <span className="text-muted-foreground">Vol </span>
          <span className="font-medium text-foreground">
            {candle.volume.toLocaleString('en-US')}
          </span>
        </span>
      </div>
    </div>
  );
}

export function PriceChart({
  candles,
  height = 460,
  watermark,
  priceScaleLocked = false,
  fitRequest = 0,
  resetRequest = 0,
  volumeVisible = true,
  crosshairMode = 'free',
  orderAnnotationsVisible = true,
  orderLines = NO_ORDER_LINES,
  fillMarkers = NO_FILL_MARKERS,
  providerFactory = createLightweightChartProvider,
}: {
  candles: readonly Candle[];
  height?: number | string;
  watermark?: string;
  priceScaleLocked?: boolean;
  fitRequest?: number;
  resetRequest?: number;
  volumeVisible?: boolean;
  crosshairMode?: ChartCrosshairMode;
  orderAnnotationsVisible?: boolean;
  orderLines?: readonly ChartOrderLine[];
  fillMarkers?: readonly ChartMarker[];
  providerFactory?: ChartProviderFactory;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<ChartProvider | null>(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState<Candle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const provider = providerFactory();
    providerRef.current = provider;
    setFailed(false);
    try {
      provider.initialize(container, {
        ...(typeof height === 'number' ? { height } : {}),
        onError: () => setFailed(true),
      });
      const unsubscribe = provider.subscribeCrosshair(setHovered);
      return () => {
        unsubscribe();
        provider.destroy();
        providerRef.current = null;
      };
    } catch {
      setFailed(true);
      provider.destroy();
      providerRef.current = null;
    }
  }, [height, providerFactory]);

  useEffect(() => providerRef.current?.setCandles(candles), [candles]);
  useEffect(() => providerRef.current?.setScaleLocked(priceScaleLocked), [priceScaleLocked]);
  useEffect(() => providerRef.current?.setVolumeVisible(volumeVisible), [volumeVisible]);
  useEffect(() => providerRef.current?.setCrosshairMode(crosshairMode), [crosshairMode]);
  useEffect(() => providerRef.current?.setWatermark(watermark ?? null), [watermark]);
  useEffect(
    () => providerRef.current?.setOrderAnnotationsVisible(orderAnnotationsVisible),
    [orderAnnotationsVisible],
  );
  useEffect(() => providerRef.current?.setOrderLines(orderLines), [orderLines]);
  useEffect(() => providerRef.current?.setMarkers(fillMarkers), [fillMarkers]);
  useEffect(() => {
    if (fitRequest > 0) providerRef.current?.fitContent();
  }, [fitRequest]);
  useEffect(() => {
    if (resetRequest > 0) providerRef.current?.resetView();
  }, [resetRequest]);

  if (failed) {
    return (
      <div
        role="status"
        className="flex items-center justify-center border border-border bg-card p-6 text-sm text-muted-foreground"
        style={{ height }}
      >
        The interactive chart could not be rendered. The data table remains available in Session.
      </div>
    );
  }

  const lastCandle = candles.length > 0 ? candles[candles.length - 1]! : null;

  return (
    <div
      aria-hidden
      data-testid="provider-chart"
      className="relative w-full overflow-hidden border border-border bg-background shadow-inner shadow-background/60"
      style={{ height }}
    >
      <ChartLegend candle={hovered ?? lastCandle} />
      <div ref={containerRef} className="absolute inset-0 z-10" />
    </div>
  );
}

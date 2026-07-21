import type { Candle } from '../types';

export type ChartCrosshairMode = 'free' | 'magnet';

export interface ChartOrderLine {
  id: string;
  price: number;
  role: 'entry' | 'stop_loss' | 'take_profit';
  side: 'buy' | 'sell';
  label: string;
}

export interface ChartMarker {
  id: string;
  time: number;
  price: number;
  side: 'buy' | 'sell';
  kind: 'entry_fill' | 'exit_fill';
  label: string;
}

export interface ChartProviderOptions {
  height?: number;
  onError?: () => void;
}

export type CrosshairSubscriber = (candle: Candle | null) => void;

export interface ChartLogicalRange {
  from: number;
  to: number;
}

/**
 * Provider-neutral boundary for the capabilities MetaTradee genuinely uses.
 * It deliberately contains no React, replay, simulation, market-data vendor,
 * or chart-renderer types.
 */
export interface ChartProvider {
  initialize(container: HTMLElement, options?: ChartProviderOptions): void;
  destroy(): void;
  setCandles(candles: readonly Candle[]): void;
  updateCandle(candle: Candle): void;
  setVolumeVisible(visible: boolean): void;
  setMarkers(markers: readonly ChartMarker[]): void;
  setOrderLines(lines: readonly ChartOrderLine[]): void;
  setScaleLocked(locked: boolean): void;
  setVisibleLogicalRange(range: ChartLogicalRange): void;
  fitContent(): void;
  resetView(): void;
  subscribeCrosshair(subscriber: CrosshairSubscriber): () => void;
  setCrosshairMode(mode: ChartCrosshairMode): void;
  setWatermark(label: string | null): void;
  setOrderAnnotationsVisible(visible: boolean): void;
}

export type ChartProviderFactory = () => ChartProvider;

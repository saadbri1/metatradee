/**
 * The only Lightweight Charts import boundary in MetaTradee.
 *
 * A future authorized Advanced Charts adapter implements the same narrow
 * `ChartProvider` contract. Replay, simulation, journal, and analytics remain
 * unaware of which renderer is active.
 */
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import type { Candle } from '../types';
import type {
  ChartCrosshairMode,
  ChartLogicalRange,
  ChartMarker,
  ChartOrderLine,
  ChartProvider,
  ChartProviderOptions,
  CrosshairSubscriber,
} from './types';

const RIGHT_OFFSET_BARS = 3;

function tokenColor(el: HTMLElement, name: string, alpha?: number): string {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return 'transparent';
  return alpha === undefined ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

function candleBar(candle: Candle) {
  return {
    time: candle.time as Time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

export class LightweightChartProvider implements ChartProvider {
  private container: HTMLElement | null = null;
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private markerPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  private priceLines: IPriceLine[] = [];
  private markers: readonly ChartMarker[] = [];
  private orderLines: readonly ChartOrderLine[] = [];
  private annotationsVisible = true;
  private scaleLocked = false;
  private watermark: HTMLDivElement | null = null;
  private onError: (() => void) | undefined;
  private subscribers = new Set<CrosshairSubscriber>();

  private readonly crosshairHandler = (param: MouseEventParams<Time>) => {
    if (!param.time || !this.candleSeries) {
      this.emitCrosshair(null);
      return;
    }
    const bar = param.seriesData.get(this.candleSeries) as
      { open: number; high: number; low: number; close: number } | undefined;
    if (!bar) {
      this.emitCrosshair(null);
      return;
    }
    const volume = this.volumeSeries
      ? (param.seriesData.get(this.volumeSeries) as { value: number } | undefined)
      : undefined;
    this.emitCrosshair({
      time: param.time as number,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: volume?.value ?? 0,
    });
  };

  initialize(container: HTMLElement, options: ChartProviderOptions = {}): void {
    this.destroy();
    this.container = container;
    this.onError = options.onError;

    const border = tokenColor(container, '--border');
    const chart = createChart(container, {
      ...(options.height === undefined ? {} : { height: options.height }),
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: tokenColor(container, '--muted-foreground'),
        fontSize: 11,
        fontFamily: getComputedStyle(container).fontFamily || undefined,
        // Required attribution. Never disable this in an adapter.
        attributionLogo: true,
      },
      grid: {
        /*
         * Horizontal lines carry more token weight because traders read price
         * against them; verticals stay quieter so the mesh remains legible on
         * the scoped terminal surface without competing with the candles.
         */
        vertLines: { color: tokenColor(container, '--border', 0.55) },
        horzLines: { color: tokenColor(container, '--border', 0.9) },
      },
      crosshair: {
        mode: 0,
        /*
         * Label chips use `--foreground` rather than `--muted`; the vendor picks
         * contrasting text from the supplied semantic background.
         */
        vertLine: {
          color: tokenColor(container, '--muted-foreground', 0.55),
          width: 1,
          style: 2,
          labelBackgroundColor: tokenColor(container, '--foreground'),
        },
        horzLine: {
          color: tokenColor(container, '--muted-foreground', 0.55),
          width: 1,
          style: 2,
          labelBackgroundColor: tokenColor(container, '--foreground'),
        },
      },
      rightPriceScale: {
        borderColor: border,
        borderVisible: true,
        // Headroom above, and clearance for the volume band below, expressed
        // proportionally — never as a hard-coded price range.
        scaleMargins: { top: 0.1, bottom: 0.26 },
        minimumWidth: 72,
      },
      timeScale: {
        borderColor: border,
        borderVisible: true,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: RIGHT_OFFSET_BARS,
        barSpacing: 8,
        minBarSpacing: 3,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: true,
      handleScale: true,
    });

    const up = tokenColor(container, '--profit');
    const down = tokenColor(container, '--loss');
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
      priceLineVisible: true,
      priceLineColor: tokenColor(container, '--muted-foreground', 0.45),
      priceLineStyle: 2,
      priceLineWidth: 1,
      // The current-price chip is a primary readout, so it stays labelled.
      lastValueVisible: true,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0.02 } });
    chart.subscribeCrosshairMove(this.crosshairHandler);

    this.chart = chart;
    this.candleSeries = candleSeries;
    this.volumeSeries = volumeSeries;
    this.markerPlugin = createSeriesMarkers(candleSeries, []);

    const watermark = document.createElement('div');
    watermark.dataset.testid = 'chart-watermark';
    watermark.className =
      'pointer-events-none absolute inset-0 z-0 flex select-none items-center justify-center';
    const label = document.createElement('span');
    /*
     * A quiet identity mark. Contract and timeframe are carried properly by
     * the legend and header, so this only needs to whisper.
     */
    label.className =
      'font-display text-2xl font-semibold tracking-tight text-muted-foreground/[0.07] sm:text-3xl';
    watermark.append(label);
    container.parentElement?.prepend(watermark);
    this.watermark = watermark;
  }

  destroy(): void {
    if (this.chart) {
      try {
        this.chart.unsubscribeCrosshairMove(this.crosshairHandler);
      } catch {
        // A partial vendor initialization may not have registered the callback.
      }
    }
    this.markerPlugin?.detach();
    this.markerPlugin = null;
    this.chart?.remove();
    this.watermark?.remove();
    this.watermark = null;
    this.chart = null;
    this.candleSeries = null;
    this.volumeSeries = null;
    this.priceLines = [];
    this.container = null;
    this.subscribers.clear();
  }

  setCandles(candles: readonly Candle[]): void {
    const container = this.container;
    if (!this.chart || !this.candleSeries || !this.volumeSeries || !container) return;
    try {
      this.candleSeries.setData(candles.map(candleBar));
      this.volumeSeries.setData(
        candles.map((candle) => ({
          time: candle.time as Time,
          value: candle.volume,
          color:
            candle.close >= candle.open
              ? tokenColor(container, '--profit', 0.28)
              : tokenColor(container, '--loss', 0.28),
        })),
      );
    } catch {
      this.fail();
    }
  }

  updateCandle(candle: Candle): void {
    const container = this.container;
    if (!this.candleSeries || !this.volumeSeries || !container) return;
    try {
      this.candleSeries.update(candleBar(candle));
      this.volumeSeries.update({
        time: candle.time as Time,
        value: candle.volume,
        color:
          candle.close >= candle.open
            ? tokenColor(container, '--profit', 0.28)
            : tokenColor(container, '--loss', 0.28),
      });
    } catch {
      this.fail();
    }
  }

  setVolumeVisible(visible: boolean): void {
    try {
      this.volumeSeries?.applyOptions({ visible });
    } catch {
      this.fail();
    }
  }

  setMarkers(markers: readonly ChartMarker[]): void {
    this.markers = markers;
    this.renderMarkers();
  }

  setOrderLines(lines: readonly ChartOrderLine[]): void {
    this.orderLines = lines;
    this.renderOrderLines();
  }

  setScaleLocked(locked: boolean): void {
    this.scaleLocked = locked;
    try {
      this.chart?.priceScale('right').applyOptions({ autoScale: !locked });
    } catch {
      this.fail();
    }
  }

  setVisibleLogicalRange(range: ChartLogicalRange): void {
    try {
      this.chart?.timeScale().setVisibleLogicalRange(range);
    } catch {
      this.fail();
    }
  }

  fitContent(): void {
    try {
      this.chart?.timeScale().fitContent();
    } catch {
      this.fail();
    }
  }

  resetView(): void {
    this.scaleLocked = false;
    try {
      this.chart?.priceScale('right').applyOptions({ autoScale: true });
      this.chart?.timeScale().fitContent();
    } catch {
      this.fail();
    }
  }

  subscribeCrosshair(subscriber: CrosshairSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  setCrosshairMode(mode: ChartCrosshairMode): void {
    try {
      this.chart?.applyOptions({ crosshair: { mode: mode === 'magnet' ? 1 : 0 } });
    } catch {
      this.fail();
    }
  }

  setWatermark(label: string | null): void {
    if (!this.watermark) return;
    this.watermark.hidden = !label;
    const text = this.watermark.firstElementChild;
    if (text) text.textContent = label ?? '';
  }

  setOrderAnnotationsVisible(visible: boolean): void {
    this.annotationsVisible = visible;
    this.renderOrderLines();
    this.renderMarkers();
  }

  private emitCrosshair(candle: Candle | null): void {
    for (const subscriber of this.subscribers) subscriber(candle);
  }

  private renderOrderLines(): void {
    const series = this.candleSeries;
    const container = this.container;
    if (!series || !container) return;
    try {
      for (const line of this.priceLines) series.removePriceLine(line);
      this.priceLines = [];
      if (!this.annotationsVisible) return;
      this.priceLines = this.orderLines.map((line) =>
        series.createPriceLine({
          price: line.price,
          color:
            line.role === 'stop_loss'
              ? tokenColor(container, '--loss')
              : line.role === 'take_profit'
                ? tokenColor(container, '--profit')
                : tokenColor(container, '--primary'),
          lineWidth: line.role === 'entry' ? 2 : 1,
          lineStyle: line.role === 'entry' ? 0 : 2,
          axisLabelVisible: true,
          title: line.label,
        }),
      );
    } catch {
      this.fail();
    }
  }

  private renderMarkers(): void {
    const container = this.container;
    if (!this.markerPlugin || !container) return;
    try {
      const markers: SeriesMarker<Time>[] = (this.annotationsVisible ? this.markers : []).map(
        (marker) => ({
          id: marker.id,
          time: marker.time as Time,
          position: marker.side === 'buy' ? 'belowBar' : 'aboveBar',
          shape: marker.side === 'buy' ? 'arrowUp' : 'arrowDown',
          color:
            marker.kind === 'entry_fill'
              ? tokenColor(container, '--primary')
              : marker.side === 'buy'
                ? tokenColor(container, '--profit')
                : tokenColor(container, '--loss'),
          text: marker.label,
        }),
      );
      this.markerPlugin.setMarkers(markers);
    } catch {
      this.fail();
    }
  }

  private fail(): void {
    this.onError?.();
  }
}

export function createLightweightChartProvider(): ChartProvider {
  return new LightweightChartProvider();
}

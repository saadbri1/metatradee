/**
 * Explicit loading / empty / error states for the chart workspace, built from
 * existing primitives and tokens. Every state is designed rather than implied.
 */
import { AlertCircle, CandlestickChart, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

function ChartStateFrame({
  height,
  tone = 'neutral',
  children,
}: {
  height: number | string;
  tone?: 'neutral' | 'error';
  children: ReactNode;
}) {
  return (
    <div
      className={`relative flex overflow-hidden border border-border bg-card ${
        tone === 'error' ? 'border-destructive/40' : ''
      }`}
      style={{ height }}
    >
      <div aria-hidden className="absolute inset-x-0 top-1/3 h-px bg-border/60" />
      <div aria-hidden className="absolute inset-x-0 top-2/3 h-px bg-border/40" />
      <div aria-hidden className="absolute inset-y-0 left-1/3 w-px bg-border/40" />
      <div aria-hidden className="absolute inset-y-0 left-2/3 w-px bg-border/40" />
      <div className="relative m-auto flex max-w-sm flex-col items-center rounded-lg border border-border bg-card px-8 py-7 text-center">
        {children}
      </div>
    </div>
  );
}

export function ChartLoading({ height = 460 }: { height?: number | string }) {
  return (
    <ChartStateFrame height={height}>
      <div role="status" aria-live="polite" className="flex flex-col items-center">
        <span className="flex size-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-semibold">Loading chart…</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Preparing the historical candle workspace.
        </p>
        <div aria-hidden className="mt-4 flex items-end gap-1">
          {[3, 6, 4, 8, 5, 7, 4].map((heightValue, index) => (
            <span
              key={`${heightValue}-${index}`}
              className="w-1 animate-pulse bg-primary/40"
              style={{ height: `${heightValue * 2}px` }}
            />
          ))}
        </div>
      </div>
    </ChartStateFrame>
  );
}

export function ChartEmpty({ height = 460 }: { height?: number | string }) {
  return (
    <ChartStateFrame height={height}>
      <span className="flex size-10 items-center justify-center border border-border bg-muted/30">
        <CandlestickChart className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">No candles to display</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        The provider returned no bars for this contract and UTC range. Adjust the request instead of
        substituting synthetic data.
      </p>
    </ChartStateFrame>
  );
}

export function ChartError({
  message,
  height = 460,
}: {
  message?: string;
  height?: number | string;
}) {
  return (
    <ChartStateFrame height={height} tone="error">
      <div role="alert" className="flex flex-col items-center">
        <span className="flex size-10 items-center justify-center border border-destructive/30 bg-destructive/10">
          <AlertCircle className="size-5 text-destructive" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-semibold">Could not load the price series</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {message ?? 'Something went wrong while preparing this chart.'}
        </p>
      </div>
    </ChartStateFrame>
  );
}

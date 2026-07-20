/**
 * Explicit loading / empty / error states for the chart workspace, built from
 * existing primitives and tokens. Every state is designed rather than implied.
 */
import { AlertCircle, CandlestickChart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function ChartLoading({ height = 460 }: { height?: number | string }) {
  return (
    <Card className="h-full rounded-none border-0">
      <CardContent className="h-full p-0">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center border border-border bg-muted/30"
          style={{ height }}
        >
          <span className="text-sm text-muted-foreground">Loading chart…</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartEmpty({ height = 460 }: { height?: number | string }) {
  return (
    <Card className="h-full rounded-none border-0">
      <CardContent className="h-full p-0">
        <div
          className="flex flex-col items-center justify-center gap-2 border border-dashed border-border"
          style={{ height }}
        >
          <CandlestickChart className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No candles to display</p>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            This workspace has no price series loaded yet.
          </p>
        </div>
      </CardContent>
    </Card>
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
    <Card className="h-full rounded-none border-0">
      <CardContent className="h-full p-0">
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-2 border border-destructive/40 bg-destructive/5"
          style={{ height }}
        >
          <AlertCircle className="size-8 text-destructive" aria-hidden />
          <p className="text-sm font-medium">Could not load the price series</p>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            {message ?? 'Something went wrong while preparing this chart.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

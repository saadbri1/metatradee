'use client';

/**
 * Chart request controls.
 *
 * A native `<select>` backs the timeframe rather than the Radix `Select`
 * primitive: for four fixed options it needs no JavaScript, works with every
 * assistive technology and mobile picker unmodified, and stays keyboard- and
 * test-reachable. The Radix component is the right choice for rich menus; this
 * is not one.
 *
 * Datetimes are entered and interpreted as UTC. `datetime-local` has no
 * timezone, so the label says UTC explicitly — a range silently shifted by the
 * viewer's offset would return the wrong bars and look perfectly plausible.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TIMEFRAMES, type Timeframe } from '@/features/market-data/databento/aggregate';

export interface ChartControlsValue {
  symbol: string;
  timeframe: Timeframe;
  /** `datetime-local` shape: YYYY-MM-DDTHH:mm, interpreted as UTC. */
  start: string;
  end: string;
}

/**
 * Defaults sit inside the range already verified end-to-end against the live
 * provider (same contract and session), so the first load a developer performs
 * is known-good rather than a guess that returns an empty series. One hour of
 * 1-minute bars gives the chart a professional density; nothing is fetched
 * until the user explicitly asks.
 */
export const DEFAULT_CONTROLS: ChartControlsValue = {
  symbol: 'ESM2',
  timeframe: '1m',
  start: '2022-06-06T20:50',
  end: '2022-06-06T21:50',
};

/** `datetime-local` → ISO 8601 UTC, which is what the API requires. */
export function toIsoUtc(local: string): string {
  return `${local}:00Z`;
}

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export function ChartControls({
  value,
  onChange,
  onSubmit,
  loading,
  disabled = false,
  compact = false,
}: {
  value: ChartControlsValue;
  onChange: (next: ChartControlsValue) => void;
  onSubmit: () => void;
  loading: boolean;
  /** True while replay is active: a new load would swap candles under it. */
  disabled?: boolean;
  /** Compact composition for the market-toolbar popover. */
  compact?: boolean;
}) {
  return (
    <form
      aria-label="Market data request"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) onSubmit();
      }}
      className={
        compact
          ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-5'
          : 'grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5'
      }
    >
      {/*
        A disabled fieldset disables every descendant control natively — one
        switch, zero per-input wiring. `contents` keeps the grid layout intact.
      */}
      <fieldset disabled={disabled} className="contents" data-testid="chart-controls-fieldset">
        <div className="space-y-1.5">
          <Label htmlFor="chart-symbol">Contract</Label>
          <Input
            id="chart-symbol"
            name="symbol"
            value={value.symbol}
            spellCheck={false}
            autoComplete="off"
            placeholder="ESZ5"
            aria-describedby="chart-symbol-hint"
            onChange={(e) => onChange({ ...value, symbol: e.target.value.toUpperCase() })}
          />
          <p id="chart-symbol-hint" className="text-xs text-muted-foreground">
            Dated contract, e.g. ESZ5
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="chart-timeframe">Timeframe</Label>
          <select
            id="chart-timeframe"
            name="timeframe"
            className={selectClass}
            value={value.timeframe}
            onChange={(e) => onChange({ ...value, timeframe: e.target.value as Timeframe })}
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="chart-start">Start (UTC)</Label>
          <Input
            id="chart-start"
            name="start"
            type="datetime-local"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="chart-end">End (UTC)</Label>
          <Input
            id="chart-end"
            name="end"
            type="datetime-local"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </div>

        <div className="flex items-end">
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Loading…' : 'Load candles'}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

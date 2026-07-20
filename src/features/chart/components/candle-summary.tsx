/**
 * Accessible alternative to the canvas chart.
 *
 * The chart renders to <canvas>, which exposes nothing to assistive technology,
 * so this is not a nicety — it is the only way the data is reachable by screen
 * reader or keyboard. It mirrors the contract already established by
 * `features/analytics/components/equity-chart.tsx`: a text summary plus a
 * keyboard-reachable data table, with direction never conveyed by colour alone
 * (the sign is spelled out in text).
 *
 * Server component — no client JS.
 */
import type { Candle, CandleSummary } from '../types';

const MAX_TABLE_ROWS = 100;

function fmt(n: number): string {
  return n.toFixed(2);
}

function isoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/** One sentence describing the series, used as the chart's accessible name. */
export function buildSummaryText(summary: CandleSummary, symbol: string): string {
  if (summary.count === 0 || !summary.first || !summary.last) {
    return `${symbol}: no candles to display.`;
  }
  const dir = summary.change === null ? 'unchanged' : summary.change >= 0 ? 'up' : 'down';
  const pct = summary.changePercent === null ? '' : ` (${fmt(summary.changePercent)}%)`;
  return (
    `${symbol}: ${summary.count} candles from ${isoDate(summary.first.time)} to ` +
    `${isoDate(summary.last.time)}. Opened ${fmt(summary.first.open)}, closed ` +
    `${fmt(summary.last.close)} — ${dir} ${fmt(Math.abs(summary.change ?? 0))}${pct}. ` +
    `High ${fmt(summary.high ?? 0)}, low ${fmt(summary.low ?? 0)}. ` +
    `Total volume ${summary.totalVolume.toLocaleString('en-US')}.`
  );
}

export function CandleSummaryPanel({
  candles,
  summary,
  symbol,
}: {
  candles: Candle[];
  summary: CandleSummary;
  symbol: string;
}) {
  const text = buildSummaryText(summary, symbol);
  const rows = candles.slice(-MAX_TABLE_ROWS);

  return (
    <section aria-label="Candle data" className="space-y-3">
      <p className="text-sm text-muted-foreground">{text}</p>

      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-4 py-2 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          Show candle data table
        </summary>
        <div className="max-h-80 overflow-auto px-4 pb-4">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              {text} Showing the most recent {rows.length} of {summary.count} candles.
            </caption>
            <thead className="sticky top-0 bg-card">
              <tr className="text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">
                  Time (UTC)
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  Open
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  High
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  Low
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  Close
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Volume
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.time} className="border-t border-border/60">
                  <th scope="row" className="py-1 pr-3 font-normal">
                    {isoDate(c.time)}
                  </th>
                  <td className="tabular py-1 pr-3 text-right">{fmt(c.open)}</td>
                  <td className="tabular py-1 pr-3 text-right">{fmt(c.high)}</td>
                  <td className="tabular py-1 pr-3 text-right">{fmt(c.low)}</td>
                  <td className="tabular py-1 pr-3 text-right">{fmt(c.close)}</td>
                  <td className="tabular py-1 text-right">{c.volume.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

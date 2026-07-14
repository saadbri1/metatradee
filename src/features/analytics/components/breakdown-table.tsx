import { cn } from '@/lib/utils';
import { Money } from '@/features/journal/components/pnl';
import type { BreakdownRow } from '../types';

/**
 * Breakdown grid. Real <table> semantics (screen-reader friendly). The inline
 * bar is a redundant visual encoding of Net P&L — value is always shown as text,
 * and profit/loss uses the reserved --profit/--loss tokens (dual-encoded, not
 * color-only).
 */
export function BreakdownTable({
  rows,
  dimensionLabel,
}: {
  rows: BreakdownRow[];
  dimensionLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No trades to break down in this range.
      </p>
    );
  }
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.kpis.netProfit)), 1);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">Performance by {dimensionLabel}</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2">
              {dimensionLabel}
            </th>
            <th scope="col" className="px-3 py-2">
              Net P&amp;L
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Win rate
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Trades
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const positive = r.kpis.netProfit >= 0;
            const width = (Math.abs(r.kpis.netProfit) / maxAbs) * 100;
            return (
              <tr key={r.key} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  {r.label}
                </th>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('h-2 rounded-sm', positive ? 'bg-profit' : 'bg-loss')}
                      style={{ width: `${Math.max(2, width)}%` }}
                      aria-hidden
                    />
                    <Money value={r.kpis.netProfit} colored />
                  </div>
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {r.kpis.winRate === null ? '—' : `${(r.kpis.winRate * 100).toFixed(0)}%`}
                </td>
                <td className="tabular px-3 py-2 text-right">{r.kpis.totalTrades}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

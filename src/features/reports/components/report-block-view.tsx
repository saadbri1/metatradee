'use client';

/**
 * Renders one RenderedBlock on-screen with accessible tables (proper scope/
 * headers). Figures are the engines' own outputs (reconcile with the app). Notes
 * are escaped by React by default. Sensitive blocks carry a visible marker.
 */
import type { Kpis, BreakdownRow, RiskStats } from '@/features/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RenderedBlock } from '../types';

function KpiTable({ k }: { k: Kpis }) {
  const rows: [string, string | number][] = [
    ['Total trades', k.totalTrades],
    ['Win rate', k.winRate === null ? '—' : `${Math.round(k.winRate * 100)}%`],
    ['Net P&L', k.netProfit],
    ['Profit factor', k.profitFactor ?? '—'],
    ['Expectancy', k.expectancy ?? '—'],
    ['Avg R:R', k.avgRr ?? '—'],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BreakdownTable({ rows, caption }: { rows: BreakdownRow[]; caption: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data in scope.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2">
              Group
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Trades
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Win rate
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Net P&amp;L
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {r.label}
              </th>
              <td className="tabular px-3 py-2 text-right">{r.kpis.totalTrades}</td>
              <td className="tabular px-3 py-2 text-right">
                {r.kpis.winRate === null ? '—' : `${Math.round(r.kpis.winRate * 100)}%`}
              </td>
              <td className="tabular px-3 py-2 text-right">{r.kpis.netProfit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportBlockView({ block }: { block: RenderedBlock }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{block.title}</CardTitle>
        {block.sensitive ? (
          <Badge variant="outline" aria-label="Sensitive data — excluded from public shares">
            Private
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {block.data === null ? (
          <p className="text-sm text-muted-foreground">
            No data for this block in the selected scope.
          </p>
        ) : block.kind === 'kpis' ? (
          <KpiTable k={block.data as Kpis} />
        ) : block.kind === 'session_performance' ? (
          <BreakdownTable rows={block.data as BreakdownRow[]} caption="Performance by session" />
        ) : block.kind === 'strategy_performance' ? (
          <BreakdownTable rows={block.data as BreakdownRow[]} caption="Performance by strategy" />
        ) : block.kind === 'trade_distribution' ? (
          <BreakdownTable rows={block.data as BreakdownRow[]} caption="Distribution by symbol" />
        ) : block.kind === 'risk' ? (
          <p className="text-sm text-muted-foreground">
            {(() => {
              const r = block.data as RiskStats;
              return `${r.tradesWithRisk} trades with recorded risk · ${r.tradesMissingRisk} missing.`;
            })()}
          </p>
        ) : block.kind === 'notes' ? (
          <p className="whitespace-pre-wrap text-sm">{String(block.data)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Included in full PDF/JSON export.</p>
        )}
      </CardContent>
    </Card>
  );
}

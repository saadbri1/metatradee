'use client';

/**
 * Grid view — the same data and the same actions as the table, laid out as
 * compact cards. It is deliberately NOT a reduced-capability decoration: search,
 * filters, sorting, detail navigation, and the full row action menu all apply.
 */
import Link from 'next/link';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { money, percent, ratio, integer } from '@/features/analytics/format';
import type { PlaybookListRow } from '../filters';
import { STATUS_LABEL } from '../labels';
import { PlaybookRowActions, type RowActionHandlers } from './playbook-row-actions';

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-0.5 truncate text-sm font-semibold tabular-nums',
          tone === 'profit' && 'text-profit',
          tone === 'loss' && 'text-loss',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function PlaybookGrid({
  rows,
  reviewedAvailable,
  actions,
}: {
  rows: PlaybookListRow[];
  reviewedAvailable: boolean;
  actions: RowActionHandlers;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const { kpis, reviewedRate } = row.metrics;
        const noTrades = kpis.totalTrades === 0;
        const pnlTone = noTrades
          ? undefined
          : kpis.netProfit > 0
            ? 'profit'
            : kpis.netProfit < 0
              ? 'loss'
              : undefined;

        return (
          <li
            key={row.id}
            className="flex flex-col rounded-md border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)] transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5">
              <div className="min-w-0">
                <Link
                  href={`/playbook/${row.id}`}
                  className="flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {row.is_pinned ? (
                    <Star
                      className="size-3 shrink-0 fill-warning text-warning"
                      aria-label="Pinned"
                    />
                  ) : null}
                  <span className="truncate text-sm font-medium hover:text-primary">
                    {row.name}
                  </span>
                </Link>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {row.category ?? 'Uncategorised'} · {row.rule_count} rule
                  {row.rule_count === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    row.status === 'active' && 'border-primary/30 bg-primary/10 text-primary',
                    row.status !== 'active' && 'border-border bg-muted/50 text-muted-foreground',
                  )}
                >
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
                <PlaybookRowActions row={row} actions={actions} />
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-3 px-3 py-3">
              <Metric label="Trades" value={integer(kpis.totalTrades)} />
              <Metric
                label="Net P&L"
                value={noTrades ? '—' : money(kpis.netProfit)}
                tone={pnlTone}
              />
              <Metric
                label="Win rate"
                value={kpis.winRate === null ? '—' : percent(kpis.winRate, 1)}
              />
              <Metric label="Expectancy" value={money(kpis.expectancy)} />
              <Metric label="Profit factor" value={ratio(kpis.profitFactor)} />
              <Metric
                label="Reviewed"
                value={!reviewedAvailable || reviewedRate === null ? '—' : percent(reviewedRate, 0)}
              />
            </dl>

            {row.symbols.length > 0 || row.timeframes.length > 0 ? (
              <div className="flex flex-wrap gap-1 px-3 pb-3">
                {[...row.symbols.slice(0, 3), ...row.timeframes.slice(0, 2)].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

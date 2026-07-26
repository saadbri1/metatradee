'use client';

/**
 * The dense Playbook table.
 *
 * Presentation only: every number arrives pre-computed from the engine in
 * `performance.ts`. No financial arithmetic happens in this component.
 */
import Link from 'next/link';
import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { money, percent, ratio, integer } from '@/features/analytics/format';
import {
  winLossRatio,
  type PlaybookListRow,
  type PlaybookSort,
  type PlaybookSortKey,
} from '../filters';
import { STATUS_LABEL } from '../labels';
import { PlaybookRowActions, type RowActionHandlers } from './playbook-row-actions';

export interface PlaybookColumn {
  id: PlaybookSortKey | 'status' | 'wl_ratio';
  label: string;
  align: 'left' | 'right';
  sortable: boolean;
  /** Optional — hidden by default in Column visibility. */
  optional?: boolean;
}

export const PLAYBOOK_COLUMNS: PlaybookColumn[] = [
  { id: 'name', label: 'Playbook', align: 'left', sortable: true },
  { id: 'status', label: 'Status', align: 'left', sortable: false },
  { id: 'trades', label: 'Trades', align: 'right', sortable: true },
  { id: 'net_pnl', label: 'Net P&L', align: 'right', sortable: true },
  { id: 'expectancy', label: 'Expectancy', align: 'right', sortable: true },
  { id: 'win_rate', label: 'Win Rate', align: 'right', sortable: true },
  { id: 'profit_factor', label: 'Profit Factor', align: 'right', sortable: true },
  { id: 'avg_win', label: 'Avg Winner', align: 'right', sortable: true, optional: true },
  { id: 'avg_loss', label: 'Avg Loser', align: 'right', sortable: true, optional: true },
  { id: 'wl_ratio', label: 'Avg W/L', align: 'right', sortable: false, optional: true },
  { id: 'reviewed', label: 'Reviewed', align: 'right', sortable: true },
  { id: 'updated', label: 'Updated', align: 'right', sortable: true },
];

/** Identity columns a user may not hide. */
export const REQUIRED_COLUMNS = new Set<PlaybookColumn['id']>(['name', 'status', 'net_pnl']);
export const DEFAULT_COLUMNS: PlaybookColumn['id'][] = PLAYBOOK_COLUMNS.filter(
  (column) => !column.optional,
).map((column) => column.id);

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        status === 'active' && 'border-primary/30 bg-primary/10 text-primary',
        status === 'draft' && 'border-border bg-muted/60 text-muted-foreground',
        status === 'archived' && 'border-border bg-muted/40 text-muted-foreground',
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Semantic P&L colour, always paired with the signed number itself. */
function pnlTone(value: number | null, trades: number): string {
  if (trades === 0 || value === null) return 'text-muted-foreground';
  if (value > 0) return 'text-profit';
  if (value < 0) return 'text-loss';
  return '';
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ariaSort(column: PlaybookColumn, sort: PlaybookSort): 'ascending' | 'descending' | 'none' {
  if (!column.sortable || sort.key !== column.id) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

export function PlaybookTable({
  rows,
  sort,
  onSort,
  visibleColumns,
  reviewedAvailable,
  actions,
}: {
  rows: PlaybookListRow[];
  sort: PlaybookSort;
  onSort: (key: PlaybookSortKey) => void;
  visibleColumns: Set<PlaybookColumn['id']>;
  reviewedAvailable: boolean;
  actions: RowActionHandlers;
}) {
  const columns = PLAYBOOK_COLUMNS.filter((column) => visibleColumns.has(column.id));

  return (
    <div className="overflow-x-auto rounded-md border border-border/70 bg-card">
      <table className="w-full min-w-[1040px] border-collapse text-xs">
        <caption className="sr-only">
          Playbooks with performance measured from linked trades
        </caption>
        <thead className="sticky top-0 z-10 bg-muted/60 text-[11px] text-muted-foreground backdrop-blur">
          <tr className="border-b border-border/70">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                aria-sort={ariaSort(column, sort)}
                className={cn(
                  'whitespace-nowrap font-medium',
                  column.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.id as PlaybookSortKey)}
                    className={cn(
                      'flex w-full items-center gap-1 px-3 py-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      column.align === 'right' && 'flex-row-reverse',
                      sort.key === column.id && 'text-foreground',
                    )}
                  >
                    {column.label}
                    {sort.key === column.id ? (
                      sort.direction === 'desc' ? (
                        <ArrowDown className="size-3" aria-hidden />
                      ) : (
                        <ArrowUp className="size-3" aria-hidden />
                      )
                    ) : null}
                  </button>
                ) : (
                  // Not sortable — rendered as plain text so it never looks clickable.
                  <span className="block px-3 py-2">{column.label}</span>
                )}
              </th>
            ))}
            <th scope="col" className="w-12 px-3 py-2 text-right">
              <span className="sr-only">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { kpis, reviewedRate } = row.metrics;
            const noTrades = kpis.totalTrades === 0;
            const cell = (id: PlaybookColumn['id']) => {
              switch (id) {
                case 'name':
                  return (
                    <td key={id} className="max-w-[280px] px-3 py-0">
                      <Link
                        href={`/playbook/${row.id}`}
                        className="flex items-center gap-1.5 py-2.5 font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {row.is_pinned ? (
                          <Star
                            className="size-3 shrink-0 fill-warning text-warning"
                            aria-label="Pinned"
                          />
                        ) : null}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate">{row.name}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {row.name}
                            {row.category ? ` · ${row.category}` : ''}
                          </TooltipContent>
                        </Tooltip>
                      </Link>
                    </td>
                  );
                case 'status':
                  return (
                    <td key={id} className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                  );
                case 'trades':
                  return (
                    <td key={id} className="px-3 py-2 text-right tabular-nums">
                      {integer(kpis.totalTrades)}
                    </td>
                  );
                case 'net_pnl':
                  return (
                    <td
                      key={id}
                      className={cn(
                        'px-3 py-2 text-right font-medium tabular-nums',
                        pnlTone(kpis.netProfit, kpis.totalTrades),
                      )}
                    >
                      {noTrades ? '—' : money(kpis.netProfit)}
                    </td>
                  );
                case 'expectancy':
                  return (
                    <td
                      key={id}
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        pnlTone(kpis.expectancy, kpis.totalTrades),
                      )}
                    >
                      {money(kpis.expectancy)}
                    </td>
                  );
                case 'win_rate':
                  return (
                    <td key={id} className="px-3 py-2 text-right tabular-nums text-profit">
                      {kpis.winRate === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        percent(kpis.winRate, 2)
                      )}
                    </td>
                  );
                case 'profit_factor':
                  return (
                    <td
                      key={id}
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        kpis.profitFactor === null
                          ? 'text-muted-foreground'
                          : kpis.profitFactor >= 1
                            ? 'text-profit'
                            : 'text-loss',
                      )}
                    >
                      {ratio(kpis.profitFactor)}
                    </td>
                  );
                case 'avg_win':
                  return (
                    <td key={id} className="px-3 py-2 text-right tabular-nums">
                      {kpis.avgWin === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-profit">{money(kpis.avgWin)}</span>
                      )}
                    </td>
                  );
                case 'avg_loss':
                  return (
                    <td key={id} className="px-3 py-2 text-right tabular-nums">
                      {kpis.avgLoss === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-loss">{money(-Math.abs(kpis.avgLoss))}</span>
                      )}
                    </td>
                  );
                case 'wl_ratio':
                  return (
                    <td key={id} className="px-3 py-2 text-right tabular-nums">
                      {ratio(winLossRatio(kpis))}
                    </td>
                  );
                case 'reviewed':
                  return (
                    <td key={id} className="px-3 py-2 text-right tabular-nums">
                      {!reviewedAvailable || reviewedRate === null ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground">—</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {reviewedAvailable
                              ? 'No linked trades to review yet.'
                              : 'Review state is unavailable until the trade review migration is applied.'}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        percent(reviewedRate, 0)
                      )}
                    </td>
                  );
                case 'updated':
                  return (
                    <td
                      key={id}
                      className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground"
                    >
                      {formatUpdated(row.updated_at)}
                    </td>
                  );
              }
            };

            return (
              <tr
                key={row.id}
                className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40"
              >
                {columns.map((column) => cell(column.id))}
                <td className="px-2 py-2 text-right">
                  <PlaybookRowActions row={row} actions={actions} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

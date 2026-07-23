'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp, Check, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TradeSort } from '../filters';
import type { TradeListRow, TradeTag } from '../types';
import { Money } from './pnl';

export type ColumnId =
  | 'open'
  | 'close'
  | 'symbol'
  | 'side'
  | 'status'
  | 'quantity'
  | 'entry'
  | 'exit'
  | 'net_pnl'
  | 'rr'
  | 'duration'
  | 'setup'
  | 'tags'
  | 'notes';

export const OPTIONAL_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'close', label: 'Close date' },
  { id: 'side', label: 'Side' },
  { id: 'status', label: 'Status' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'entry', label: 'Entry' },
  { id: 'exit', label: 'Exit' },
  { id: 'rr', label: 'R-multiple' },
  { id: 'duration', label: 'Duration' },
  { id: 'setup', label: 'Setup' },
  { id: 'tags', label: 'Tags / Mistakes' },
  { id: 'notes', label: 'Notes' },
];
// Identity columns are always shown and cannot be hidden.
export const REQUIRED_COLUMNS = new Set<ColumnId>(['open', 'symbol', 'net_pnl']);
export const DEFAULT_VISIBLE: ColumnId[] = [
  'open',
  'symbol',
  'side',
  'status',
  'quantity',
  'entry',
  'exit',
  'net_pnl',
  'rr',
  'duration',
  'setup',
  'tags',
  'notes',
];

/** Which sort each sortable column header toggles between. */
const SORT_MAP: Partial<Record<ColumnId, [TradeSort, TradeSort]>> = {
  open: ['newest', 'oldest'],
  close: ['newest', 'oldest'],
  symbol: ['alpha', 'alpha'],
  net_pnl: ['profit', 'loss'],
  duration: ['duration', 'duration'],
  rr: ['rr', 'rr'],
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB').replace(/\//g, '-');
}
function fmtNum(v: number | null, digits = 2): string {
  return v === null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: digits });
}
function fmtDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  const s = Math.floor(seconds % 60);
  return m >= 1 ? `${m}m` : `${s}s`;
}

function StatusBadge({ trade }: { trade: TradeListRow }) {
  const closed = Boolean(trade.closed_at);
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          closed
            ? 'border-border bg-muted/60 text-muted-foreground'
            : 'border-primary/30 bg-primary/10 text-primary',
        )}
      >
        {closed ? 'Closed' : 'Open'}
      </span>
      {trade.source === 'imported' ? (
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Imported
        </span>
      ) : null}
    </span>
  );
}

function TagPills({ tags, onTag }: { tags: TradeTag[]; onTag: (tag: TradeTag) => void }) {
  if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown = tags.slice(0, 2);
  const extra = tags.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTag(tag);
          }}
          className={cn(
            'max-w-[120px] truncate rounded-full px-2 py-0.5 text-[10px] font-medium',
            tag.category === 'mistake'
              ? 'bg-warning/15 text-warning'
              : tag.category === 'setup'
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground',
          )}
          aria-label={`Filter by ${tag.category === 'mistake' ? 'mistake ' : ''}${tag.name}`}
          title={`Filter by ${tag.name}`}
        >
          {tag.name}
        </button>
      ))}
      {extra > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{extra}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {tags
              .slice(2)
              .map((t) => t.name)
              .join(', ')}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}

function ariaSortFor(id: ColumnId, sort: TradeSort): 'ascending' | 'descending' | 'none' {
  const pair = SORT_MAP[id];
  if (!pair || !pair.includes(sort)) return 'none';
  return sort === pair[0] ? 'descending' : 'ascending';
}

/** A sortable column header. `aria-sort` lives on the parent <th>. */
function SortHeader({
  id,
  label,
  align,
  sort,
  onSort,
}: {
  id: ColumnId;
  label: string;
  align?: 'right';
  sort: TradeSort;
  onSort: (s: TradeSort) => void;
}) {
  const pair = SORT_MAP[id];
  if (!pair) {
    return <span className={cn('px-3 py-2', align === 'right' && 'text-right')}>{label}</span>;
  }
  const active = pair.includes(sort);
  const isDesc = sort === pair[0];
  const next = sort === pair[0] ? pair[1] : pair[0];
  return (
    <button
      type="button"
      onClick={() => onSort(next)}
      className={cn(
        'flex items-center gap-1 px-3 py-2 font-medium hover:text-foreground',
        align === 'right' && 'ml-auto flex-row-reverse',
        active && 'text-foreground',
      )}
    >
      {label}
      {active ? (
        isDesc ? (
          <ArrowDown className="size-3" aria-hidden />
        ) : (
          <ArrowUp className="size-3" aria-hidden />
        )
      ) : null}
    </button>
  );
}

export function TradeLogTable({
  items,
  visibleColumns,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onSetReviewed,
  sort,
  onSort,
  onTag,
}: {
  items: TradeListRow[];
  visibleColumns: Set<ColumnId>;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onSetReviewed: (id: string, value: boolean) => void;
  sort: TradeSort;
  onSort: (s: TradeSort) => void;
  onTag: (tag: TradeTag) => void;
}) {
  const show = (id: ColumnId) => visibleColumns.has(id);
  const allSelected = items.length > 0 && items.every((t) => selected.has(t.id));
  const someSelected = items.some((t) => selected.has(t.id));

  return (
    <div className="overflow-x-auto rounded-md border border-border/70">
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <caption className="sr-only">Trade log</caption>
        <thead className="sticky top-0 z-10 bg-muted/60 text-[11px] text-muted-foreground backdrop-blur">
          <tr className="border-b border-border/70">
            <th scope="col" className="w-10 px-3 py-2 text-center">
              <span className="sr-only">Reviewed</span>✓
            </th>
            <th scope="col" className="w-9 px-2 py-2">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(c) => onToggleSelectAll(c === true)}
                aria-label="Select all trades on this page"
              />
            </th>
            <th scope="col" aria-sort={ariaSortFor('open', sort)} className="text-left">
              <SortHeader id="open" label="Open Date" sort={sort} onSort={onSort} />
            </th>
            {show('close') ? (
              <th scope="col" aria-sort={ariaSortFor('close', sort)} className="text-left">
                <SortHeader id="close" label="Close" sort={sort} onSort={onSort} />
              </th>
            ) : null}
            <th scope="col" aria-sort={ariaSortFor('symbol', sort)} className="text-left">
              <SortHeader id="symbol" label="Symbol" sort={sort} onSort={onSort} />
            </th>
            {show('side') ? (
              <th scope="col" className="px-3 py-2 text-left">
                Side
              </th>
            ) : null}
            {show('status') ? (
              <th scope="col" className="px-3 py-2 text-left">
                Status
              </th>
            ) : null}
            {show('quantity') ? (
              <th scope="col" className="px-3 py-2 text-right">
                Qty
              </th>
            ) : null}
            {show('entry') ? (
              <th scope="col" className="px-3 py-2 text-right">
                Entry
              </th>
            ) : null}
            {show('exit') ? (
              <th scope="col" className="px-3 py-2 text-right">
                Exit
              </th>
            ) : null}
            <th scope="col" aria-sort={ariaSortFor('net_pnl', sort)} className="text-right">
              <SortHeader id="net_pnl" label="Net P&L" align="right" sort={sort} onSort={onSort} />
            </th>
            {show('rr') ? (
              <th scope="col" aria-sort={ariaSortFor('rr', sort)} className="text-right">
                <SortHeader id="rr" label="R" align="right" sort={sort} onSort={onSort} />
              </th>
            ) : null}
            {show('duration') ? (
              <th scope="col" aria-sort={ariaSortFor('duration', sort)} className="text-left">
                <SortHeader id="duration" label="Duration" sort={sort} onSort={onSort} />
              </th>
            ) : null}
            {show('setup') ? (
              <th scope="col" className="px-3 py-2 text-left">
                Setup
              </th>
            ) : null}
            {show('tags') ? (
              <th scope="col" className="px-3 py-2 text-left">
                Tags
              </th>
            ) : null}
            {show('notes') ? (
              <th scope="col" className="px-3 py-2 text-center">
                Notes
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr
              key={t.id}
              className="group border-b border-border/60 transition-colors duration-fast hover:bg-muted/40 motion-reduce:transition-none"
              data-testid="trade-row"
            >
              <td className="px-3 py-0 text-center">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={t.reviewed}
                  aria-label={`${t.reviewed ? 'Mark unreviewed' : 'Mark reviewed'}: ${t.symbol}`}
                  onClick={() => onSetReviewed(t.id, !t.reviewed)}
                  className={cn(
                    'grid size-5 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    t.reviewed
                      ? 'border-profit bg-profit text-white'
                      : 'border-border text-transparent hover:border-foreground/40',
                  )}
                >
                  <Check className="size-3" aria-hidden />
                </button>
              </td>
              <td className="px-2 py-1.5">
                <Checkbox
                  checked={selected.has(t.id)}
                  onCheckedChange={() => onToggleSelect(t.id)}
                  aria-label={`Select ${t.symbol}`}
                />
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                <Link
                  href={`/journal/${t.id}`}
                  className="rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {fmtDate(t.opened_at ?? t.created_at)}
                </Link>
              </td>
              {show('close') ? (
                <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                  {fmtDate(t.closed_at)}
                </td>
              ) : null}
              <td className="px-3 py-1.5">
                <Link
                  href={`/journal/${t.id}`}
                  className="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {t.symbol}
                </Link>
              </td>
              {show('side') ? (
                <td
                  className={cn(
                    'px-3 py-1.5 font-medium',
                    t.direction === 'buy' ? 'text-profit' : 'text-loss',
                  )}
                >
                  {t.direction === 'buy' ? 'Long' : 'Short'}
                </td>
              ) : null}
              {show('status') ? (
                <td className="px-3 py-1.5">
                  <StatusBadge trade={t} />
                </td>
              ) : null}
              {show('quantity') ? (
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(t.quantity, 4)}</td>
              ) : null}
              {show('entry') ? (
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(t.entry_price)}</td>
              ) : null}
              {show('exit') ? (
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(t.exit_price)}</td>
              ) : null}
              <td className="px-3 py-1.5 text-right">
                <Money value={t.net_pnl} currency={t.currency} colored />
              </td>
              {show('rr') ? (
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {t.rr_ratio === null ? '—' : `${t.rr_ratio.toFixed(2)}R`}
                </td>
              ) : null}
              {show('duration') ? (
                <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                  {fmtDuration(t.duration_seconds)}
                </td>
              ) : null}
              {show('setup') ? (
                <td
                  className="max-w-[140px] truncate px-3 py-1.5 text-muted-foreground"
                  title={t.setup ?? undefined}
                >
                  {t.setup || '—'}
                </td>
              ) : null}
              {show('tags') ? (
                <td className="px-3 py-1.5">
                  <TagPills tags={t.tags} onTag={onTag} />
                </td>
              ) : null}
              {show('notes') ? (
                <td className="px-3 py-1.5 text-center">
                  {t.notes ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex text-muted-foreground" aria-label="Has notes">
                          <FileText className="size-3.5" aria-hidden />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{t.notes.slice(0, 160)}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

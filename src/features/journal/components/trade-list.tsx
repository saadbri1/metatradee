'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FormAlert } from '@/features/auth/components/form-alert';
import {
  parseTradeQuery,
  serializeTradeQuery,
  type TradeFilters,
  type TradeSort,
} from '../filters';
import { useTradesInfinite, useJournalSummary, useSetReviewed, useBulkReviewed } from '../hooks';
import type { TradeListRow, TradeTag } from '../types';
import { JournalSummaryRow } from './journal-summary';
import { TradeLogTable, DEFAULT_VISIBLE, OPTIONAL_COLUMNS, type ColumnId } from './trade-log-table';

const PAGE_SIZES = [10, 20, 30, 50] as const;

export function TradeList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters, sort } = useMemo(
    () => parseTradeQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [pageSize, setPageSize] = useState<number>(30);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(filters.search ?? '');
  const [visible, setVisible] = useState<Set<ColumnId>>(new Set(DEFAULT_VISIBLE));
  const [reviewError, setReviewError] = useState('');

  const query = useTradesInfinite(filters, sort, pageSize);
  const summaryQuery = useJournalSummary(filters);
  const setReviewed = useSetReviewed(filters, sort, pageSize);
  const bulkReviewed = useBulkReviewed();

  const pages = query.data?.pages ?? [];
  const currentPage = pages[pageIndex];
  const items: TradeListRow[] = currentPage?.items ?? [];
  const total = summaryQuery.data?.totalTrades ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pushQuery(next: Partial<TradeFilters> & { sort?: TradeSort }) {
    const { sort: nextSort, ...nextFilters } = next;
    const qs = serializeTradeQuery({ ...filters, ...nextFilters }, nextSort ?? sort);
    setPageIndex(0);
    setSelected(new Set());
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  function commitSearch() {
    pushQuery({ search: search || undefined });
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(items.map((t) => t.id)) : new Set());
  }

  function toggleReviewed(id: string, value: boolean) {
    setReviewError('');
    setReviewed.mutate({ id, value }, { onError: (error) => setReviewError(error.message) });
  }

  function filterByTag(tag: TradeTag) {
    pushQuery({ tag_ids: [tag.id] });
  }

  function toggleColumn(id: ColumnId) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function goToPage(index: number) {
    if (index < 0) return;
    // Fetch forward pages lazily until the requested page exists.
    while (index >= (query.data?.pages.length ?? 0) && query.hasNextPage) {
      await query.fetchNextPage();
    }
    if (index < (query.data?.pages.length ?? 0)) setPageIndex(index);
  }

  const selectedIds = [...selected];
  const activeFilterCount = Object.keys(filters).length;

  const first = total === 0 ? 0 : pageIndex * pageSize + 1;
  const last = pageIndex * pageSize + items.length;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">Trade Log</h1>
            {total > 0 ? (
              <p className="text-xs text-muted-foreground">
                {total.toLocaleString()} {total === 1 ? 'trade' : 'trades'}
                {activeFilterCount > 0
                  ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`
                  : ''}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 ? (
              <Button variant="ghost" size="sm" className="h-9" onClick={() => pushQuery({})}>
                <RotateCcw aria-hidden /> Reset
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline" className="h-9 rounded-md">
              <Link href="/journal/import">
                <Download aria-hidden /> Import trades
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 rounded-md">
              <Link href="/journal/new">
                <Plus aria-hidden /> New trade
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI summary */}
        <JournalSummaryRow summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="relative flex-1 sm:max-w-xs"
            onSubmit={(e) => {
              e.preventDefault();
              commitSearch();
            }}
          >
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={commitSearch}
              placeholder="Search symbol…"
              aria-label="Search trades by symbol"
              className="h-9 pl-8"
            />
          </form>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Columns3 aria-hidden /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {OPTIONAL_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={visible.has(col.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleColumn(col.id)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setVisible(new Set(DEFAULT_VISIBLE))}>
                <RotateCcw aria-hidden /> Restore defaults
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {filters.reviewed !== undefined ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-9"
              onClick={() => pushQuery({ reviewed: undefined })}
            >
              {filters.reviewed ? 'Reviewed' : 'Unreviewed'} <X aria-hidden />
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  Reviewed
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => pushQuery({ reviewed: true })}>
                  Reviewed only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => pushQuery({ reviewed: false })}>
                  Unreviewed only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Select value={sort} onValueChange={(v) => pushQuery({ sort: v as TradeSort })}>
            <SelectTrigger className="h-9 w-36" aria-label="Sort trades">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="profit">Most profit</SelectItem>
              <SelectItem value="loss">Most loss</SelectItem>
              <SelectItem value="duration">Longest</SelectItem>
              <SelectItem value="rr">Best R</SelectItem>
              <SelectItem value="alpha">Symbol A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
            role="region"
            aria-label="Bulk actions"
          >
            <span className="text-sm font-medium" aria-live="polite">
              {selectedIds.length} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() =>
                bulkReviewed.mutate(
                  { ids: selectedIds, reviewed: true },
                  { onSuccess: () => setSelected(new Set()) },
                )
              }
              disabled={bulkReviewed.isPending}
            >
              Mark reviewed
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() =>
                bulkReviewed.mutate(
                  { ids: selectedIds, reviewed: false },
                  { onSuccess: () => setSelected(new Set()) },
                )
              }
              disabled={bulkReviewed.isPending}
            >
              Mark unreviewed
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setSelected(new Set())}
            >
              <X aria-hidden /> Clear
            </Button>
          </div>
        ) : null}

        {reviewError ? <FormAlert tone="error">{reviewError}</FormAlert> : null}

        {/* Table / states */}
        {query.isLoading ? (
          <div className="space-y-2" aria-label="Loading trades" aria-busy>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-md border border-border/60 bg-muted/40"
              />
            ))}
          </div>
        ) : query.isError ? (
          <div className="rounded-md border border-border/70 bg-card p-4">
            <FormAlert tone="error">Couldn&apos;t load your trades.</FormAlert>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-border/70 bg-card">
            <div className="border-b border-border/70 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Trade log
            </div>
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <p className="text-sm font-medium">
                {activeFilterCount > 0 ? 'No trades match these filters' : 'No trades yet'}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {activeFilterCount > 0
                  ? 'Adjust or reset the filters to see your trades.'
                  : 'Add your first trade or import your history to get started.'}
              </p>
              <div className="flex gap-2">
                {activeFilterCount > 0 ? (
                  <Button size="sm" variant="outline" onClick={() => pushQuery({})}>
                    Reset filters
                  </Button>
                ) : null}
                <Button asChild size="sm">
                  <Link href="/journal/new">Add a trade</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/journal/import">Import trades</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <TradeLogTable
            items={items}
            visibleColumns={visible}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onSetReviewed={toggleReviewed}
            sort={sort}
            onSort={(s) => pushQuery({ sort: s })}
            onTag={filterByTag}
          />
        )}

        {/* Pagination footer */}
        {items.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Trades per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPageIndex(0);
                  setSelected(new Set());
                }}
              >
                <SelectTrigger className="h-8 w-[72px]" aria-label="Trades per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="tabular-nums">
                {first}–{last} of {total.toLocaleString()} trades
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Previous page"
                disabled={pageIndex === 0}
                onClick={() => goToPage(pageIndex - 1)}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <span className="tabular-nums" aria-live="polite">
                Page {pageIndex + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Next page"
                disabled={pageIndex + 1 >= totalPages || query.isFetchingNextPage}
                onClick={() => goToPage(pageIndex + 1)}
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

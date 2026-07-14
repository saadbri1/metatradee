'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, LayoutGrid, List as ListIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormAlert } from '@/features/auth/components/form-alert';
import { EmptyState, FormSkeleton } from '@/features/workspace/components/states';
import { parseTradeQuery, serializeTradeQuery, TRADE_SORTS, type TradeSort } from '../filters';
import { useTradesInfinite, useBulkTradeAction } from '../hooks';
import type { TradeRow } from '../types';
import { TradeTable } from './trade-table';
import { TradeCard } from './trade-card';

const sortLabels: Record<TradeSort, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  profit: 'Most profit',
  loss: 'Most loss',
  duration: 'Longest',
  rr: 'Best R:R',
  alpha: 'Symbol A–Z',
};

export function TradeList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters, sort } = useMemo(
    () => parseTradeQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [view, setView] = useState<'table' | 'card'>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(filters.search ?? '');

  const query = useTradesInfinite(filters, sort);
  const bulk = useBulkTradeAction();

  const items: TradeRow[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  function pushQuery(next: Partial<typeof filters> & { sort?: TradeSort }) {
    const { sort: nextSort, ...nextFilters } = next;
    const qs = serializeTradeQuery({ ...filters, ...nextFilters }, nextSort ?? sort);
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  function commitSearch() {
    pushQuery({ search: search || undefined });
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(items.map((t) => t.id)) : new Set());
  }

  const selectedIds = [...selected];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Journal</h1>
        <Button asChild>
          <Link href="/journal/new">
            <Plus aria-hidden /> New trade
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex-1 sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            commitSearch();
          }}
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={commitSearch}
            placeholder="Search symbol…"
            aria-label="Search trades"
          />
        </form>

        <Select value={sort} onValueChange={(v) => pushQuery({ sort: v as TradeSort })}>
          <SelectTrigger className="w-40" aria-label="Sort trades">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRADE_SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {sortLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border border-border" role="group" aria-label="View">
          <Button
            type="button"
            variant={view === 'table' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setView('table')}
            aria-pressed={view === 'table'}
            aria-label="Table view"
          >
            <ListIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant={view === 'card' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setView('card')}
            aria-pressed={view === 'card'}
            aria-label="Card view"
          >
            <LayoutGrid aria-hidden />
          </Button>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              bulk.mutate(
                { op: 'archive', ids: selectedIds },
                { onSuccess: () => setSelected(new Set()) },
              )
            }
          >
            Archive
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              bulk.mutate(
                { op: 'delete', ids: selectedIds },
                { onSuccess: () => setSelected(new Set()) },
              )
            }
          >
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {query.isLoading ? (
        <FormSkeleton rows={8} />
      ) : query.isError ? (
        <FormAlert tone="error">Couldn&apos;t load your trades. Please retry.</FormAlert>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-8" />}
          title="No trades yet"
          description="Add your first trade or import your history to get started."
          action={
            <Button asChild>
              <Link href="/journal/new">Add your first trade</Link>
            </Button>
          }
        />
      ) : view === 'table' ? (
        <TradeTable items={items} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <TradeCard key={t.id} trade={t} />
          ))}
        </div>
      )}

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

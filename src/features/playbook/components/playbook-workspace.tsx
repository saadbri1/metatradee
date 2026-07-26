'use client';

/**
 * The Playbook workspace: header, tabs, toolbar, and the List/Grid result
 * surface.
 *
 * State lives in the URL (tab, search, filters, sort, page, view) exactly as the
 * Journal and Analytics workspaces do, so links are shareable and back/forward
 * behave. Filtering and sorting run through the pure pipeline in `filters.ts`;
 * this component renders and dispatches, and computes no metric itself.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Columns3,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormAlert } from '@/features/auth/components/form-alert';
import { money, integer } from '@/features/analytics/format';
import {
  activeFilterCount,
  nextSort,
  parsePlaybookQuery,
  selectPlaybooks,
  serializePlaybookQuery,
  type PlaybookFilters,
  type PlaybookQuery,
  type PlaybookSortKey,
  type PlaybookTab,
  type PlaybookView,
} from '../filters';
import { readViewPreference, saveViewPreference } from '../view-preference';
import {
  usePlaybookWorkspace,
  useDeleteStrategy,
  useDuplicateStrategy,
  usePinStrategy,
  useStrategyStatus,
} from '../hooks';
import type { PlaybookWorkspaceData } from '../server/queries';
import {
  PlaybookTable,
  DEFAULT_COLUMNS,
  PLAYBOOK_COLUMNS,
  REQUIRED_COLUMNS,
} from './playbook-table';
import { PlaybookGrid } from './playbook-grid';
import { PlaybookFilterPanel } from './playbook-filter-panel';
import type { RowActionHandlers } from './playbook-row-actions';

type ColumnId = (typeof PLAYBOOK_COLUMNS)[number]['id'];

/**
 * There is no playbook sharing architecture — no share table, no permission
 * model, no server-side authorization. The tab is rendered disabled with the
 * exact reason rather than faked, so the workspace stays honest about what it
 * can actually do.
 */
const SHARED_TAB_REASON =
  'Shared playbooks are unavailable: MetaTradee has no playbook sharing or permission model yet.';

export function PlaybookWorkspace({ initialData }: { initialData?: PlaybookWorkspaceData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo(
    () => parsePlaybookQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const workspace = usePlaybookWorkspace(initialData);
  const [search, setSearch] = useState(query.filters.search ?? '');
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(
    () => new Set(DEFAULT_COLUMNS),
  );
  const [actionError, setActionError] = useState('');
  const [viewSeeded, setViewSeeded] = useState(false);

  const duplicate = useDuplicateStrategy();
  const status = useStrategyStatus();
  const remove = useDeleteStrategy();
  const pin = usePinStrategy();

  const push = useCallback(
    (next: Partial<PlaybookQuery>) => {
      const merged: Partial<PlaybookQuery> = {
        tab: next.tab ?? query.tab,
        filters: next.filters ?? query.filters,
        sort: next.sort ?? query.sort,
        view: next.view ?? query.view,
        // Any change other than paging returns to the first page, so a narrowed
        // result set can never strand the user on an empty page.
        page: next.page ?? 0,
      };
      const qs = serializePlaybookQuery(merged);
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [pathname, query, router],
  );

  // Seed the view from the remembered preference on first mount only when the
  // URL does not already state one.
  useEffect(() => {
    if (viewSeeded) return;
    setViewSeeded(true);
    if (searchParams.get('view')) return;
    const preferred = readViewPreference();
    if (preferred !== 'list') push({ view: preferred });
    // Intentionally first-mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSeeded]);

  // Keep the search box in step with external URL changes (Reset, back button).
  useEffect(() => {
    setSearch(query.filters.search ?? '');
  }, [query.filters.search]);

  const data = workspace.data;
  // Memoised so the `?? []` fallback does not produce a new array identity on
  // every render and re-run the selection pipeline needlessly.
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const page = useMemo(() => selectPlaybooks(rows, query), [rows, query]);
  const filterCount = activeFilterCount(query.filters);
  const archivedCount = rows.filter((row) => row.status === 'archived').length;
  const activeCount = rows.length - archivedCount;

  function setView(view: PlaybookView) {
    saveViewPreference(view);
    push({ view });
  }

  function applyFilters(filters: PlaybookFilters) {
    push({ filters: { ...filters, ...(search ? { search } : {}) } });
  }

  function resetAll() {
    setSearch('');
    push({ filters: {}, sort: undefined, page: 0 });
    router.replace(pathname, { scroll: false });
  }

  async function guard(run: () => Promise<unknown>) {
    setActionError('');
    try {
      await run();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Something went wrong.';
      setActionError(message);
      throw cause;
    }
  }

  const actions: RowActionHandlers = {
    pending: duplicate.isPending || status.isPending || remove.isPending || pin.isPending,
    onDuplicate: (row) => guard(() => duplicate.mutateAsync(row.id)).then(() => undefined),
    onArchive: (row) =>
      guard(() => status.mutateAsync({ id: row.id, status: 'archived' })).then(() => undefined),
    onRestore: (row) =>
      guard(() => status.mutateAsync({ id: row.id, status: 'active' })).then(() => undefined),
    // Delete reports failures inside its own confirmation dialog, where the
    // user is looking. Routing it through `guard` too would show the same
    // message twice.
    onDelete: (row) => remove.mutateAsync(row.id).then(() => undefined),
    onPin: (row) =>
      guard(() => pin.mutateAsync({ id: row.id, pinned: !row.is_pinned })).then(() => undefined),
  };

  const totalNetPnl = rows
    .filter((row) => row.status !== 'archived')
    .reduce((sum, row) => sum + row.metrics.kpis.netProfit, 0);
  const linkedTrades = rows.reduce((sum, row) => sum + row.metrics.kpis.totalTrades, 0);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3">
        {/* ---------------------------------------------------------------- */}
        {/* Header */}
        {/* ---------------------------------------------------------------- */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-tight">Playbook</h1>
            <p className="text-xs text-muted-foreground">
              {rows.length === 0
                ? 'Document a strategy, then measure it against your real trades.'
                : `${integer(rows.length)} playbook${rows.length === 1 ? '' : 's'} · ${integer(linkedTrades)} linked trade${linkedTrades === 1 ? '' : 's'} · net ${money(totalNetPnl)}`}
              {filterCount > 0 ? ` · ${filterCount} filter${filterCount === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {filterCount > 0 || query.filters.search ? (
              <Button variant="ghost" size="sm" className="h-9" onClick={resetAll}>
                <RotateCcw className="size-3.5" aria-hidden /> Reset
              </Button>
            ) : null}
            <Button asChild size="sm" className="h-9">
              <Link href="/playbook/new">
                <Plus className="size-4" aria-hidden /> Create Playbook
              </Link>
            </Button>
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Tabs + toolbar */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Playbook views" className="flex items-center gap-1">
            <TabButton
              active={query.tab === 'active'}
              count={activeCount}
              onClick={() => push({ tab: 'active' })}
            >
              My Playbooks
            </TabButton>
            <TabButton
              active={query.tab === 'archived'}
              count={archivedCount}
              onClick={() => push({ tab: 'archived' })}
            >
              Archived
            </TabButton>
            {/* Rendered but disabled: the reference has this tab, MetaTradee has
                no sharing model, and a fake tab would be worse than an honest
                one that says why. */}
            <button
              type="button"
              role="tab"
              disabled
              aria-disabled="true"
              aria-selected="false"
              title={SHARED_TAB_REASON}
              className="cursor-not-allowed rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground/60"
            >
              Shared Playbooks
              <span className="sr-only"> — {SHARED_TAB_REASON}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={search}
                aria-label="Search playbooks"
                placeholder="Search"
                className="h-9 w-52 pl-8"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    push({ filters: { ...query.filters, search: search || undefined } });
                  }
                  if (event.key === 'Escape') {
                    setSearch('');
                    push({ filters: { ...query.filters, search: undefined } });
                  }
                }}
                onBlur={() => {
                  if ((query.filters.search ?? '') !== search) {
                    push({ filters: { ...query.filters, search: search || undefined } });
                  }
                }}
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearch('');
                    push({ filters: { ...query.filters, search: undefined } });
                  }}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>

            <PlaybookFilterPanel
              filters={query.filters}
              categories={data?.categories ?? []}
              symbols={data?.symbols ?? []}
              reviewedAvailable={data?.reviewedAvailable ?? false}
              onApply={applyFilters}
              onReset={resetAll}
            />

            {/* View switch */}
            <div
              className="flex items-center rounded-md border border-border/70 p-0.5"
              role="group"
              aria-label="Result view"
            >
              <button
                type="button"
                aria-label="List view"
                aria-pressed={query.view === 'list'}
                onClick={() => setView('list')}
                className={cn(
                  'rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground',
                  query.view === 'list' && 'bg-muted text-foreground',
                )}
              >
                <List className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={query.view === 'grid'}
                onClick={() => setView('grid')}
                className={cn(
                  'rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground',
                  query.view === 'grid' && 'bg-muted text-foreground',
                )}
              >
                <LayoutGrid className="size-4" aria-hidden />
              </button>
            </div>

            {query.view === 'list' ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-9" aria-label="Columns">
                    <Columns3 className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  {PLAYBOOK_COLUMNS.map((column) => {
                    const required = REQUIRED_COLUMNS.has(column.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={visibleColumns.has(column.id)}
                        disabled={required}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={() =>
                          setVisibleColumns((previous) => {
                            const next = new Set(previous);
                            if (next.has(column.id)) next.delete(column.id);
                            else next.add(column.id);
                            return next;
                          })
                        }
                      >
                        {column.label}
                        {required ? <span className="sr-only"> (always shown)</span> : null}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        {actionError ? <FormAlert tone="error">{actionError}</FormAlert> : null}

        {/* ---------------------------------------------------------------- */}
        {/* Results */}
        {/* ---------------------------------------------------------------- */}
        {workspace.isLoading ? (
          <ResultSkeleton view={query.view} />
        ) : workspace.isError ? (
          <div className="rounded-md border border-border/70 bg-card p-4">
            <FormAlert tone="error">
              Couldn&apos;t load your playbooks. Your filters have been kept.
            </FormAlert>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void workspace.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : page.total === 0 ? (
          <EmptyResult
            tab={query.tab}
            filtered={filterCount > 0 || Boolean(query.filters.search)}
            onReset={resetAll}
          />
        ) : query.view === 'grid' ? (
          <PlaybookGrid
            rows={page.rows}
            reviewedAvailable={data?.reviewedAvailable ?? false}
            actions={actions}
          />
        ) : (
          <PlaybookTable
            rows={page.rows}
            sort={query.sort}
            onSort={(key: PlaybookSortKey) => push({ sort: nextSort(query.sort, key) })}
            visibleColumns={visibleColumns}
            reviewedAvailable={data?.reviewedAvailable ?? false}
            actions={actions}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Pagination */}
        {/* ---------------------------------------------------------------- */}
        {page.total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p aria-live="polite">
              Showing {page.first}–{page.last} of {page.total}
            </p>
            {page.pageCount > 1 ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Previous page"
                  disabled={page.page === 0}
                  onClick={() => push({ page: page.page - 1 })}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </Button>
                <span className="px-1 tabular-nums">
                  Page {page.page + 1} of {page.pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Next page"
                  disabled={page.page >= page.pageCount - 1}
                  onClick={() => push({ page: page.page + 1 })}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {children}
      <span className="ml-1.5 tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

/** Stable skeletons: the page keeps its shape so nothing jumps on load. */
function ResultSkeleton({ view }: { view: PlaybookView }) {
  if (view === 'grid') {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[148px] rounded-md" />
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-border/70">
      <Skeleton className="h-9 rounded-none" />
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="mt-px h-[42px] rounded-none" />
      ))}
    </div>
  );
}

function EmptyResult({
  tab,
  filtered,
  onReset,
}: {
  tab: PlaybookTab;
  filtered: boolean;
  onReset: () => void;
}) {
  if (filtered) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-6 py-10 text-center">
        <p className="text-sm font-medium">No playbooks match these filters</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try a broader search, or clear the filters to see everything again.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onReset}>
          Clear filters
        </Button>
      </div>
    );
  }
  if (tab === 'archived') {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-6 py-10 text-center">
        <p className="text-sm font-medium">Nothing archived</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Archiving keeps a playbook and its trade history without cluttering your active list.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <ClipboardList className="mx-auto size-7 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-sm font-medium">No playbooks yet</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
        A playbook records the rules you actually trade — entry, invalidation, risk, and exit. Once
        your trades are linked to one, MetaTradee measures its real expectancy, win rate, and profit
        factor from those trades.
      </p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/playbook/new">
          <Plus className="size-4" aria-hidden /> Create Playbook
        </Link>
      </Button>
    </div>
  );
}

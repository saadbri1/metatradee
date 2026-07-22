'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, LayoutGrid, Menu, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AddAccountDialog } from '@/features/accounts/components/add-account-dialog';
import { ManageAccountsDialog } from '@/features/accounts/components/manage-accounts-dialog';
import { UserMenu } from '@/features/shell/components/user-menu';
import type { ShellUser } from '@/features/shell/types';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import { buildDashboardProjection, EMPTY_DASHBOARD_FILTERS } from '../projection';
import type { DashboardData, DashboardFilters } from '../types';
import { saveDashboardWidgetLayoutAction } from '../server/actions';
import {
  DEFAULT_DASHBOARD_WIDGET_LAYOUT,
  dashboardWidgetLayoutsEqual,
  moveDashboardWidget,
  visibleWidgetIds,
  widgetDefinition,
  type DashboardWidgetId,
  type DashboardWidgetLayout,
} from '../widget-preferences';
import { DashboardFiltersBar } from './dashboard-filters';
import {
  AvailableWidgets,
  EditableWidgetFrame,
  WidgetEditorToolbar,
  type WidgetEditorProps,
} from './dashboard-widget-editor';
import { OpenPositionsCard } from './open-positions-card';
import { PerformanceSummary } from './performance-summary';
import { PnlWorkspaceCard } from './pnl-workspace-card';
import { TradingCalendarCard } from './trading-calendar-card';
import { WinRateCard } from './win-rate-card';

function importStatusLabel(status: string | null): string {
  if (!status) return 'No imports yet';
  if (status === 'completed') return 'Import complete';
  if (status === 'importing') return 'Import in progress';
  if (status === 'failed') return 'Last import failed';
  if (status === 'cancelled') return 'Last import cancelled';
  if (status === 'rolled_back') return 'Last import rolled back';
  return 'Import ready for review';
}

function formatImportTime(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function DashboardOverview({
  name,
  data,
  user,
  initialWidgetLayout = DEFAULT_DASHBOARD_WIDGET_LAYOUT,
}: {
  name: string;
  data: DashboardData;
  user?: ShellUser;
  initialWidgetLayout?: DashboardWidgetLayout;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const openMobileNavigation = useUIStore((state) => state.setMobileDrawerOpen);
  const [accountOpen, setAccountOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const accountTrigger = useRef<HTMLElement | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({ ...EMPTY_DASHBOARD_FILTERS });

  const [savedWidgetLayout, setSavedWidgetLayout] = useState(initialWidgetLayout);
  const [draftWidgetLayout, setDraftWidgetLayout] = useState(initialWidgetLayout);
  const [isEditingWidgets, setIsEditingWidgets] = useState(false);
  const [widgetStatus, setWidgetStatus] = useState('');
  const [widgetError, setWidgetError] = useState('');
  const [isSavingWidgets, startSavingWidgets] = useTransition();
  const editWidgetsTrigger = useRef<HTMLButtonElement | null>(null);
  const widgetLayout = isEditingWidgets ? draftWidgetLayout : savedWidgetLayout;
  const widgetLayoutIsDirty = !dashboardWidgetLayoutsEqual(draftWidgetLayout, savedWidgetLayout);

  useEffect(() => {
    if (search.get('addAccount') !== '1') return;
    if (document.activeElement instanceof HTMLElement)
      accountTrigger.current = document.activeElement;
    setAccountOpen(true);
  }, [search]);

  // Clear the saved/cancelled confirmation once editing has finished.
  useEffect(() => {
    if (isEditingWidgets || !widgetStatus) return;
    const timeout = window.setTimeout(() => setWidgetStatus(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [isEditingWidgets, widgetStatus]);

  const projection = useMemo(
    () => buildDashboardProjection(data.trades, data.accounts, filters, data.timezone),
    [data, filters],
  );
  const symbols = useMemo(
    () => [...new Set(data.trades.map((trade) => trade.symbol))].sort(),
    [data.trades],
  );
  const selectedAccounts =
    filters.accountIds.length > 0
      ? data.accounts.filter((account) => filters.accountIds.includes(account.id))
      : data.accounts;
  const currency = selectedAccounts.length === 1 ? selectedAccounts[0]!.base_currency : 'USD';
  const shellUser: ShellUser = user ?? {
    displayName: name,
    username: null,
    email: null,
    avatarUrl: null,
  };

  function chooseDay(day: string) {
    setFilters((current) => ({
      ...current,
      dateRange: 'custom',
      customStart: day,
      customEnd: day,
    }));
  }

  function closeAccountDialog(open: boolean) {
    setAccountOpen(open);
    if (!open && search.get('addAccount')) router.replace('/dashboard');
  }

  function beginWidgetEditing() {
    setDraftWidgetLayout(savedWidgetLayout);
    setWidgetError('');
    setWidgetStatus('Editing dashboard. Use each widget’s controls to hide or reorder it.');
    setIsEditingWidgets(true);
  }

  function focusEditWidgetsTrigger() {
    window.setTimeout(() => editWidgetsTrigger.current?.focus(), 0);
  }

  function cancelWidgetEditing() {
    if (widgetLayoutIsDirty && !window.confirm('Discard your unsaved dashboard changes?')) return;
    // Cancel restores the exact pre-edit layout and never writes to the server.
    setDraftWidgetLayout(savedWidgetLayout);
    setWidgetError('');
    setWidgetStatus('Dashboard changes cancelled.');
    setIsEditingWidgets(false);
    focusEditWidgetsTrigger();
  }

  function hideWidget(id: DashboardWidgetId) {
    setDraftWidgetLayout((current) => ({
      ...current,
      hidden: current.hidden.includes(id) ? current.hidden : [...current.hidden, id],
    }));
    setWidgetStatus(`${widgetDefinition(id).label} hidden. It is available to add again.`);
  }

  function showWidget(id: DashboardWidgetId) {
    setDraftWidgetLayout((current) => ({
      ...current,
      hidden: current.hidden.filter((widgetId) => widgetId !== id),
    }));
    setWidgetStatus(`${widgetDefinition(id).label} shown.`);
  }

  function reorderWidget(id: DashboardWidgetId, direction: 'up' | 'down') {
    setDraftWidgetLayout((current) => moveDashboardWidget(current, id, direction));
    setWidgetStatus(`${widgetDefinition(id).label} moved ${direction}.`);
  }

  function restoreDefaultWidgets() {
    if (
      widgetLayoutIsDirty &&
      !window.confirm('Replace your unsaved customization with the default dashboard layout?')
    ) {
      return;
    }
    setDraftWidgetLayout({
      ...DEFAULT_DASHBOARD_WIDGET_LAYOUT,
      order: [...DEFAULT_DASHBOARD_WIDGET_LAYOUT.order],
      hidden: [],
    });
    setWidgetError('');
    setWidgetStatus('Default widget layout restored. Save changes to keep it.');
  }

  function saveWidgetLayout() {
    const layoutToSave = draftWidgetLayout;
    setWidgetError('');
    startSavingWidgets(async () => {
      const result = await saveDashboardWidgetLayoutAction(layoutToSave);
      if (!result.ok) {
        setWidgetError(result.error);
        setWidgetStatus('Dashboard widget changes were not saved.');
        return;
      }
      setSavedWidgetLayout(layoutToSave);
      setDraftWidgetLayout(layoutToSave);
      setIsEditingWidgets(false);
      setWidgetStatus('Dashboard widget changes saved.');
      focusEditWidgetsTrigger();
    });
  }

  const editorProps: WidgetEditorProps | undefined = isEditingWidgets
    ? { layout: draftWidgetLayout, onHide: hideWidget, onMove: reorderWidget }
    : undefined;

  // Widgets are rendered from the persisted order, per region, so a saved
  // layout reproduces the user's arrangement on the next read.
  const widgetNodes: Record<DashboardWidgetId, ReactNode> = {
    'performance-summary': <PerformanceSummary projection={projection} currency={currency} />,
    'winning-trades': <WinRateCard kind="trades" projection={projection} />,
    'winning-days': <WinRateCard kind="days" projection={projection} />,
    positions: <OpenPositionsCard projection={projection} accounts={data.accounts} />,
    'pnl-workspace': <PnlWorkspaceCard points={projection.daily} />,
    calendar: <TradingCalendarCard points={projection.daily} onSelectDay={chooseDay} />,
  };

  function renderRegion(region: 'summary' | 'primary' | 'secondary') {
    return visibleWidgetIds(widgetLayout, region).map((id) => (
      <EditableWidgetFrame key={id} id={id} editor={editorProps}>
        {widgetNodes[id]}
      </EditableWidgetFrame>
    ));
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="min-h-screen bg-muted/40">
        <header className="sticky top-0 z-30 h-16 border-b border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <div className="flex h-full items-center gap-3 px-4 md:px-5 xl:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              aria-label="Open navigation menu"
              onClick={() => openMobileNavigation(true)}
            >
              <Menu aria-hidden />
            </Button>
            <h1 className="shrink-0 font-display text-xl font-semibold tracking-tight">
              Dashboard
            </h1>

            <div
              className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Dashboard controls"
            >
              <DashboardFiltersBar
                accounts={data.accounts}
                symbols={symbols}
                filters={filters}
                onChange={setFilters}
                onManageAccounts={() => setManageOpen(true)}
              />
              <div className="shrink-0 border-l border-border/70 pl-2">
                <UserMenu user={shellUser} />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 md:px-5 xl:px-6 xl:pb-8">
          <section
            className="flex min-h-12 flex-wrap items-center gap-3"
            aria-label="Trade import status"
          >
            <Button asChild size="sm" className="h-11 rounded-md px-4">
              <Link href="/journal/import">
                <Download aria-hidden /> Import trades
              </Link>
            </Button>
            <div
              className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
              role="status"
            >
              <RefreshCw
                className={cn(
                  'size-3.5 shrink-0',
                  data.lastImportStatus === 'importing' && 'animate-spin',
                )}
                aria-hidden
              />
              <span className="truncate">
                {data.lastImportAt
                  ? `${importStatusLabel(data.lastImportStatus)} · ${formatImportTime(data.lastImportAt)}`
                  : 'No imports yet'}
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!isEditingWidgets ? (
                <Button
                  ref={editWidgetsTrigger}
                  variant="outline"
                  size="sm"
                  type="button"
                  className="h-10 rounded-md"
                  onClick={beginWidgetEditing}
                >
                  <LayoutGrid aria-hidden /> Edit widgets
                </Button>
              ) : null}
              {data.accounts.length === 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 rounded-md"
                  onClick={(event) => {
                    accountTrigger.current = event.currentTarget;
                    setAccountOpen(true);
                  }}
                >
                  <Plus aria-hidden /> Add account
                </Button>
              ) : null}
            </div>
          </section>

          {isEditingWidgets ? (
            <WidgetEditorToolbar
              onRestoreDefaults={restoreDefaultWidgets}
              onCancel={cancelWidgetEditing}
              onSave={saveWidgetLayout}
              isSaving={isSavingWidgets}
            />
          ) : null}

          {isEditingWidgets ? (
            <AvailableWidgets hidden={draftWidgetLayout.hidden} onShow={showWidget} />
          ) : null}

          {widgetStatus ? (
            <p
              className="rounded-md border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {widgetStatus}
            </p>
          ) : null}
          {widgetError ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {widgetError}
            </p>
          ) : null}

          {renderRegion('summary')}

          <div
            className="grid items-start gap-3 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,2.08fr)]"
            data-dashboard-layout="professional-analytics"
          >
            <div className="min-w-0 space-y-3" data-dashboard-column="win-rates">
              {renderRegion('primary')}
            </div>

            <div className="min-w-0 space-y-3" data-dashboard-column="analytics-calendar">
              {renderRegion('secondary')}
            </div>
          </div>
        </main>
      </div>

      <AddAccountDialog
        open={accountOpen}
        onOpenChange={closeAccountDialog}
        returnFocusTo={accountTrigger}
      />
      <ManageAccountsDialog
        accounts={data.accounts}
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </TooltipProvider>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleDollarSign, Download, LayoutGrid, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/panel';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AddAccountDialog } from '@/features/accounts/components/add-account-dialog';
import { ManageAccountsDialog } from '@/features/accounts/components/manage-accounts-dialog';
import { NotificationCenter } from '@/features/shell/components/notification-center';
import { PageHeader } from '@/features/shell/components/page-header';
import { cn } from '@/lib/utils';
import {
  buildDashboardProjection,
  calculateTrackedBalance,
  EMPTY_DASHBOARD_FILTERS,
} from '../projection';
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
import { DashboardInfoTip } from './dashboard-info-tip';
import { kpiWidgetContent } from './dashboard-kpi-row';
import {
  AvailableWidgets,
  EditableWidgetFrame,
  WidgetEditorToolbar,
  type WidgetEditorProps,
} from './dashboard-widget-editor';
import { MetaTradeeScoreCard } from './metatradee-score-card';
import { OpenPositionsCard } from './open-positions-card';
import { CumulativePnlChart, DailyPnlBarChart } from './pnl-charts';
import { TradingCalendarCard } from './trading-calendar-card';

const KPI_IDS = new Set<DashboardWidgetId>([
  'net-pnl',
  'trade-expectancy',
  'profit-factor',
  'win-rate',
  'average-win-loss',
]);

function money(value: number | null, currency: string): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

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

/**
 * Analytics widget chrome. Now just Panel — this used to hand-write the card
 * treatment, and the KPI frame below repeated the same literal independently.
 */
function AnalyticsCard({
  title,
  info,
  children,
}: {
  title: string;
  info: string;
  children: ReactNode;
}) {
  return (
    <Panel as="section" className="motion-content-enter h-full" data-dashboard-card="analytics">
      <PanelHeader>
        <PanelTitle as="h3">{title}</PanelTitle>
        <DashboardInfoTip>{info}</DashboardInfoTip>
      </PanelHeader>
      <PanelBody>{children}</PanelBody>
    </Panel>
  );
}

export function DashboardOverview({
  name,
  data,
  initialWidgetLayout = DEFAULT_DASHBOARD_WIDGET_LAYOUT,
}: {
  name: string;
  data: DashboardData;
  initialWidgetLayout?: DashboardWidgetLayout;
}) {
  const router = useRouter();
  const search = useSearchParams();
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
  const trackedBalance = useMemo(
    () => calculateTrackedBalance(selectedAccounts, projection.closedTrades),
    [selectedAccounts, projection.closedTrades],
  );

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

  function widgetNode(id: DashboardWidgetId): ReactNode {
    if (KPI_IDS.has(id)) return kpiWidgetContent(id, projection, currency);
    if (id === 'metatradee-score') {
      return (
        <AnalyticsCard
          title="MetaTradee Score"
          info="A transparent composite of win rate, profit factor, payoff ratio, and profitable-day consistency. Requires 20 closed trades."
        >
          <MetaTradeeScoreCard score={projection.score} />
        </AnalyticsCard>
      );
    }
    if (id === 'cumulative-pnl') {
      return (
        <AnalyticsCard
          title="Daily Net Cumulative P&L"
          info="Chronological sum of realized net P&L, one point per trading day."
        >
          <CumulativePnlChart points={projection.daily} heightClassName="h-[300px]" />
        </AnalyticsCard>
      );
    }
    if (id === 'daily-pnl') {
      return (
        <AnalyticsCard
          title="Net Daily P&L"
          info="Realized net P&L grouped by closing day in your workspace timezone."
        >
          <DailyPnlBarChart points={projection.daily} heightClassName="h-[300px]" />
        </AnalyticsCard>
      );
    }
    if (id === 'trades') {
      return <OpenPositionsCard projection={projection} accounts={data.accounts} />;
    }
    return <TradingCalendarCard points={projection.daily} onSelectDay={chooseDay} />;
  }

  function renderRegion(region: 'kpi' | 'analytics' | 'lower') {
    return visibleWidgetIds(widgetLayout, region).map((id) => (
      <EditableWidgetFrame
        key={id}
        id={id}
        editor={editorProps}
        className={cn(
          // The KPI frame carries the card chrome; analytics widgets bring their own.
          // Same chrome as Panel, applied to the frame the editor also wraps.
          region === 'kpi' &&
            !editorProps &&
            'overflow-hidden rounded-md border border-border/70 bg-card shadow-panel',
          region === 'lower' && id === 'calendar' && 'xl:col-span-2',
        )}
      >
        {widgetNode(id)}
      </EditableWidgetFrame>
    ));
  }

  return (
    <TooltipProvider delayDuration={120}>
      {/*
       * The Dashboard follows the one global appearance (next-themes on <html>),
       * so it stays consistent with every other route. It carries no route-scoped
       * theme of its own — all surfaces resolve from semantic tokens.
       */}
      <div className="min-h-screen bg-muted/40">
        <PageHeader
          title="Dashboard"
          actionsLabel="Dashboard controls"
          actions={
            <>
              <div
                className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-border/70 bg-background px-3"
                aria-label="Tracked balance"
              >
                <CircleDollarSign className="size-4 text-primary" aria-hidden />
                <span className="hidden text-control font-semibold tabular-nums xl:inline">
                  {data.accounts.length > 0 ? money(trackedBalance, currency) : '—'}
                </span>
              </div>
              <DashboardFiltersBar
                accounts={data.accounts}
                symbols={symbols}
                filters={filters}
                onChange={setFilters}
                onManageAccounts={() => setManageOpen(true)}
              />
              <div className="shrink-0 [&_button]:size-10 [&_button]:rounded-md [&_button]:border [&_button]:border-border/70">
                <NotificationCenter />
              </div>
            </>
          }
        />

        <main className="mx-auto max-w-[1680px] space-y-stack px-gutter py-4 md:px-5 xl:px-6 xl:pb-8">
          <section className="flex min-h-10 flex-wrap items-center gap-3">
            {/*
             * The greeting is context, not the subject of the page — it was
             * previously the largest text in the content area while carrying
             * the least information. It reads as secondary now, and is no
             * longer a heading: the page already has one, and an <h2> here
             * put a greeting above the KPI panels in the document outline.
             */}
            <p className="truncate text-control text-muted-foreground">
              {greeting()}, <span className="font-medium text-foreground">{name}</span>
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span
                className="flex items-center gap-1.5 text-meta text-muted-foreground"
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
              </span>
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
              <Button asChild size="sm" className="h-10 rounded-md px-4">
                <Link href="/journal/import">
                  <Download aria-hidden /> Import trades
                </Link>
              </Button>
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
              className="rounded-md border border-border/70 bg-card px-3 py-2 text-meta text-muted-foreground shadow-panel"
              role="status"
              aria-live="polite"
            >
              {widgetStatus}
            </p>
          ) : null}
          {widgetError ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-control font-medium text-destructive"
              role="alert"
            >
              {widgetError}
            </p>
          ) : null}

          <section
            aria-label="Key performance indicators"
            className="grid gap-stack sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            data-dashboard-layout="kpis"
          >
            {renderRegion('kpi')}
          </section>

          <div
            className="grid items-stretch gap-stack lg:grid-cols-2 xl:grid-cols-3"
            data-dashboard-layout="analytics"
          >
            {renderRegion('analytics')}
          </div>

          <div
            className="grid items-stretch gap-stack xl:grid-cols-3"
            data-dashboard-layout="lower"
          >
            {renderRegion('lower')}
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

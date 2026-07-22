'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CircleDollarSign,
  Download,
  Info,
  LayoutGrid,
  Menu,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AddAccountDialog } from '@/features/accounts/components/add-account-dialog';
import { ManageAccountsDialog } from '@/features/accounts/components/manage-accounts-dialog';
import { NotificationCenter } from '@/features/shell/components/notification-center';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import {
  buildDashboardProjection,
  calculateTrackedBalance,
  EMPTY_DASHBOARD_FILTERS,
} from '../projection';
import type { DashboardData, DashboardFilters, DashboardTrade } from '../types';
import { DashboardFiltersBar } from './dashboard-filters';
import { CumulativePnlChart, DailyPnlBarChart } from './pnl-charts';
import { TradingCalendarCard } from './trading-calendar-card';

function money(value: number | null, currency = 'USD'): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
function number(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
function pct(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function InfoTip({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="rounded-full text-muted-foreground hover:text-foreground"
          aria-label="About this metric"
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{children}</TooltipContent>
    </Tooltip>
  );
}

export function DashboardOverview({ name, data }: { name: string; data: DashboardData }) {
  const router = useRouter();
  const search = useSearchParams();
  const openMobileNavigation = useUIStore((state) => state.setMobileDrawerOpen);
  const [accountOpen, setAccountOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const accountTrigger = useRef<HTMLElement | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({ ...EMPTY_DASHBOARD_FILTERS });
  useEffect(() => {
    if (search.get('addAccount') === '1') {
      if (document.activeElement instanceof HTMLElement) {
        accountTrigger.current = document.activeElement;
      }
      setAccountOpen(true);
    }
  }, [search]);
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
  const realizedBalance = useMemo(
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

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-muted/40">
        <header className="sticky top-0 z-30 h-[68px] border-b border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <div className="mx-auto flex h-full max-w-[1680px] items-center gap-3 px-5 md:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              aria-label="Open navigation menu"
              onClick={() => openMobileNavigation(true)}
            >
              <Menu aria-hidden />
            </Button>
            <h1 className="shrink-0 font-display text-lg font-semibold tracking-tight">
              Dashboard
            </h1>

            <div
              className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Dashboard controls"
            >
              <div
                className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-border/80 bg-card px-2.5 shadow-sm"
                aria-label="Tracked balance summary"
              >
                <CircleDollarSign className="size-4 text-primary" aria-hidden />
                <div className="hidden leading-none xl:block">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    Balance
                  </p>
                  <p className="mt-1 text-xs font-semibold tabular-nums">
                    {data.accounts.length > 0 ? money(realizedBalance, currency) : '—'}
                  </p>
                </div>
              </div>
              <DashboardFiltersBar
                accounts={data.accounts}
                symbols={symbols}
                filters={filters}
                onChange={setFilters}
                onManageAccounts={() => setManageOpen(true)}
              />
              <div className="shrink-0 [&_button]:size-10 [&_button]:rounded-full [&_button]:border [&_button]:border-border/80 [&_button]:bg-card [&_button]:shadow-sm">
                <NotificationCenter />
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1680px] space-y-4 px-5 py-4 md:px-6 lg:pb-8">
          <section className="flex min-h-10 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight">
                Good{' '}
                {new Date().getHours() < 12
                  ? 'morning'
                  : new Date().getHours() < 18
                    ? 'afternoon'
                    : 'evening'}
                , {name}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw
                  className={cn(
                    'size-3.5',
                    data.lastImportStatus === 'importing' && 'animate-spin',
                  )}
                  aria-hidden
                />
                {data.lastImportAt
                  ? `Last import ${new Date(data.lastImportAt).toLocaleDateString()}`
                  : 'No imports yet'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="h-10 cursor-not-allowed opacity-50 hover:bg-background hover:text-foreground"
                    aria-disabled="true"
                    onClick={(event) => event.preventDefault()}
                  >
                    <LayoutGrid aria-hidden /> Edit widgets
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Widget customization is not available yet.</TooltipContent>
              </Tooltip>
              <Button asChild size="sm" className="h-10">
                <Link href="/journal/import">
                  <Download aria-hidden /> Import trades
                </Link>
              </Button>
              {data.accounts.length === 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10"
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

          <KpiRow projection={projection} currency={currency} />

          <div
            className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
            data-dashboard-layout="analytics"
          >
            <AnalyticsCard
              title="MetaTradee Score"
              info="A transparent composite of win rate, profit factor, payoff ratio, and profitable-day consistency. Requires 20 closed trades."
            >
              <ScoreCard score={projection.score} />
            </AnalyticsCard>
            <AnalyticsCard
              title="Daily net cumulative P&L"
              info="Chronological sum of realized net P&L, one point per trading day."
            >
              <CumulativePnlChart points={projection.daily} />
            </AnalyticsCard>
            <AnalyticsCard
              title="Net daily P&L"
              info="Realized net P&L grouped by closing day in your workspace timezone."
            >
              <DailyPnlBarChart points={projection.daily} />
            </AnalyticsCard>
          </div>

          <div
            className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
            data-dashboard-layout="lower"
          >
            <TradesCard projection={projection} accounts={data.accounts} currency={currency} />
            <TradingCalendarCard points={projection.daily} onSelectDay={chooseDay} />
          </div>
        </div>
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

function KpiRow({
  projection,
  currency,
}: {
  projection: ReturnType<typeof buildDashboardProjection>;
  currency: string;
}) {
  const cards = [
    {
      label: 'Net P&L',
      value: projection.kpis.totalTrades ? money(projection.kpis.netProfit, currency) : '—',
      info: 'Realized net P&L from closed trades after recorded fees.',
      tone: projection.kpis.netProfit,
    },
    {
      label: 'Trade expectancy',
      value: number(projection.kpis.expectancy),
      info: 'Realized net P&L divided by all closed trades, including break-even trades.',
      tone: projection.kpis.expectancy,
    },
    {
      label: 'Profit factor',
      value: number(projection.kpis.profitFactor),
      info: 'Gross winning P&L divided by absolute gross losing P&L. Unavailable when there are no losses.',
      tone: projection.kpis.profitFactor === null ? 0 : projection.kpis.profitFactor - 1,
    },
    {
      label: 'Win rate',
      value: pct(projection.kpis.winRate),
      info: 'Winning closed trades divided by all closed trades. Break-even trades remain in the denominator.',
      tone: projection.kpis.winRate === null ? 0 : projection.kpis.winRate - 0.5,
    },
    {
      label: 'Average win/loss trade',
      value: number(projection.averageWinLossRatio),
      info: 'Average winning trade divided by the absolute average losing trade.',
      tone: projection.averageWinLossRatio === null ? 0 : projection.averageWinLossRatio - 1,
    },
  ];
  return (
    <section aria-label="Key performance indicators">
      <ul
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        data-dashboard-layout="kpis"
      >
        {cards.map((card) => (
          <li
            key={card.label}
            className="group h-28 rounded-xl border border-border/60 bg-card p-4 shadow-[0_1px_2px_hsl(var(--foreground)/0.025)] transition duration-fast ease-standard hover:-translate-y-0.5 hover:border-border hover:shadow-sm motion-reduce:transition-none"
            data-dashboard-card="kpi"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{card.label}</span>
              <InfoTip>{card.info}</InfoTip>
            </div>
            <div className="mt-2.5 flex items-end justify-between gap-3">
              <p
                className={cn(
                  'text-2xl font-semibold tabular-nums tracking-tight',
                  card.tone && card.tone > 0
                    ? 'text-profit'
                    : card.tone && card.tone < 0
                      ? 'text-loss'
                      : 'text-foreground',
                )}
              >
                {card.value}
              </p>
              <div
                className={cn(
                  'grid size-9 place-items-center rounded-lg',
                  'bg-primary/8 text-primary',
                )}
              >
                <TrendingUp className="size-4" aria-hidden />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
    <section
      className="motion-content-enter overflow-hidden rounded-xl border border-border/60 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]"
      data-dashboard-card="analytics"
    >
      <header className="flex h-12 items-center gap-2 border-b border-border/60 px-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <InfoTip>{info}</InfoTip>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function ScoreCard({ score }: { score: ReturnType<typeof buildDashboardProjection>['score'] }) {
  const labels = [
    ['Win rate', score.components.winRate],
    ['Profit factor', score.components.profitFactor],
    ['Payoff', score.components.payoff],
    ['Consistency', score.components.consistency],
  ] as const;
  if (score.value === null)
    return (
      <div className="flex h-[255px] flex-col items-center justify-center text-center">
        <svg
          viewBox="0 0 260 176"
          className="h-[176px] w-full max-w-[280px]"
          role="img"
          aria-label="MetaTradee Score unavailable"
        >
          {[1, 0.72, 0.44].map((scale) => {
            const top = 88 - 68 * scale;
            const right = 130 + 86 * scale;
            const bottom = 88 + 68 * scale;
            const left = 130 - 86 * scale;
            return (
              <polygon
                key={scale}
                points={`130,${top} ${right},88 130,${bottom} ${left},88`}
                fill={scale === 1 ? 'hsl(var(--primary) / .025)' : 'none'}
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
            );
          })}
          <line x1="130" y1="20" x2="130" y2="156" stroke="hsl(var(--border))" />
          <line x1="44" y1="88" x2="216" y2="88" stroke="hsl(var(--border))" />
          {labels.map(([label], index) => {
            const positions = [
              [130, 12],
              [220, 92],
              [130, 172],
              [40, 92],
            ];
            return (
              <text
                key={label}
                x={positions[index]?.[0]}
                y={positions[index]?.[1]}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {label}
              </text>
            );
          })}
        </svg>
        <p className="mt-1 text-xs font-medium text-foreground">
          Score unlocks with {score.minimumTrades} closed trades
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">No placeholder score is shown.</p>
      </div>
    );
  return (
    <div className="grid h-[255px] place-items-center">
      <div className="relative grid size-44 place-items-center rounded-full border-[14px] border-primary/10">
        <div
          className="absolute inset-[-14px] rounded-full border-[14px] border-primary"
          style={{ clipPath: `polygon(50% 50%, 50% 0, 100% 0, 100% ${score.value}%, 50% 50%)` }}
        />
        <div className="text-center">
          <p className="text-4xl font-semibold text-primary">{score.value}</p>
          <p className="text-xs text-muted-foreground">Performance score</p>
        </div>
      </div>
    </div>
  );
}

function TradesCard({
  projection,
  accounts,
  currency,
}: {
  projection: ReturnType<typeof buildDashboardProjection>;
  accounts: DashboardData['accounts'];
  currency: string;
}) {
  const accountName = (trade: DashboardTrade) =>
    accounts.find((account) => account.id === trade.trading_account_id)?.name || 'Unassigned';
  const accountSource = (trade: DashboardTrade) =>
    accounts.find((account) => account.id === trade.trading_account_id)?.account_type ||
    'unassigned';
  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]">
      <Tabs defaultValue="positions">
        <div className="border-b border-border/60 px-3">
          <TabsList className="h-12 bg-transparent p-0">
            <TabsTrigger
              value="positions"
              className="h-12 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Open positions{' '}
              <Badge variant="secondary" className="ml-1.5">
                {projection.openTrades.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="recent"
              className="h-12 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Recent trades
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="positions" className="m-0">
          <CompactTable
            trades={projection.openTrades}
            accountName={accountName}
            accountSource={accountSource}
            currency={currency}
            open
          />
        </TabsContent>
        <TabsContent value="recent" className="m-0">
          <CompactTable
            trades={projection.recentTrades}
            accountName={accountName}
            accountSource={accountSource}
            currency={currency}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function CompactTable({
  trades,
  accountName,
  accountSource,
  currency,
  open = false,
}: {
  trades: DashboardTrade[];
  accountName: (trade: DashboardTrade) => string;
  accountSource: (trade: DashboardTrade) => string;
  currency: string;
  open?: boolean;
}) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead>
          <tr className="bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5">{open ? 'Opened' : 'Closed'}</th>
            <th className="px-3 py-2.5">Account</th>
            <th className="px-3 py-2.5">Symbol</th>
            <th className="px-3 py-2.5">Side</th>
            <th className="px-3 py-2.5 text-right">Qty</th>
            <th className="px-3 py-2.5 text-right">Entry</th>
            <th className="px-3 py-2.5 text-right">{open ? 'Latest' : 'Exit'}</th>
            <th className="px-3 py-2.5 text-right">{open ? 'Unrealized P&L' : 'Realized P&L'}</th>
            <th className="px-4 py-2.5">Source</th>
          </tr>
        </thead>
        <tbody>
          {trades.length === 0 ? (
            <tr className="border-t border-border/60">
              <td colSpan={9} className="h-64 px-4 py-8 align-top">
                <p className="text-xs font-medium">
                  {open ? 'No open positions' : 'No recent closed trades'}
                </p>
                <p className="mt-1 max-w-sm text-[11px] leading-4 text-muted-foreground">
                  {open
                    ? 'Open journal positions will appear here. Live marks remain unavailable without a supported price feed.'
                    : 'Closed trades matching the shared filters will appear here.'}
                </p>
              </td>
            </tr>
          ) : (
            trades.map((trade) => (
              <tr key={trade.id} className="border-t border-border/80 hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {new Date(
                    (open ? trade.opened_at : trade.closed_at) || trade.created_at,
                  ).toLocaleDateString()}
                </td>
                <td className="max-w-28 truncate px-3 py-2.5" title={accountName(trade)}>
                  {accountName(trade)}
                </td>
                <td className="px-3 py-2.5 font-semibold">
                  {open ? (
                    trade.symbol
                  ) : (
                    <Link
                      href={`/journal/${trade.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {trade.symbol}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2.5 capitalize">{trade.direction}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{number(trade.quantity)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{number(trade.entry_price)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {open ? <UnavailableMark /> : number(trade.exit_price)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right font-semibold tabular-nums',
                    !open && trade.net_pnl !== null && trade.net_pnl > 0
                      ? 'text-profit'
                      : !open && trade.net_pnl !== null && trade.net_pnl < 0
                        ? 'text-loss'
                        : '',
                  )}
                >
                  {open ? <UnavailableMark /> : money(trade.net_pnl, currency)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="capitalize">
                    {accountSource(trade)}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function UnavailableMark() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help text-muted-foreground">—</span>
      </TooltipTrigger>
      <TooltipContent>Unavailable without a supported live market-price feed.</TooltipContent>
    </Tooltip>
  );
}

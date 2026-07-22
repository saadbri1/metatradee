'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  CircleDollarSign,
  Download,
  Info,
  LayoutGrid,
  LockKeyhole,
  Plus,
  RefreshCw,
  Settings2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AddAccountDialog } from '@/features/accounts/components/add-account-dialog';
import { ManageAccountsDialog } from '@/features/accounts/components/manage-accounts-dialog';
import { cn } from '@/lib/utils';
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>({ ...EMPTY_DASHBOARD_FILTERS });
  useEffect(() => {
    if (search.get('addAccount') === '1') setAccountOpen(true);
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
      <div className="-mx-4 -my-6 min-h-[calc(100vh-3.5rem)] bg-[#f6f7f9] px-4 py-5 md:-mx-6 md:px-6 lg:pb-10">
        <div className="mx-auto max-w-[1680px] space-y-5">
          <section
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,.035)]"
            aria-label="Dashboard controls"
          >
            <div className="flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-full border border-border bg-primary/5 text-primary">
                <CircleDollarSign className="size-5" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tracked balance
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {data.accounts.length > 0 ? money(realizedBalance, currency) : 'No accounts'}
                </p>
              </div>
            </div>
            <DashboardFiltersBar
              accounts={data.accounts}
              symbols={symbols}
              filters={filters}
              onChange={setFilters}
            />
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell aria-hidden />
            </Button>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                Good{' '}
                {new Date().getHours() < 12
                  ? 'morning'
                  : new Date().getHours() < 18
                    ? 'afternoon'
                    : 'evening'}
                , {name}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Performance shown from realized, owner-scoped trade data.
              </p>
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
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Widget customization is coming soon"
              >
                <LayoutGrid aria-hidden /> Edit widgets
              </Button>
              <Button asChild size="sm">
                <Link href="/journal/import">
                  <Download aria-hidden /> Import trades
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setManageOpen(true)}
                disabled={data.accounts.length === 0}
              >
                <Settings2 aria-hidden /> Manage
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAccountOpen(true)}>
                <Plus aria-hidden /> Add account
              </Button>
            </div>
          </section>

          {data.accounts.length === 0 ? <NoAccounts onAdd={() => setAccountOpen(true)} /> : null}

          <KpiRow projection={projection} currency={currency} />

          <div className="grid gap-5 xl:grid-cols-[.92fr_1.08fr_1.08fr]">
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

          <div className="grid items-start gap-5 xl:grid-cols-[.92fr_2.16fr]">
            <TradesCard projection={projection} accounts={data.accounts} currency={currency} />
            <TradingCalendarCard points={projection.daily} onSelectDay={chooseDay} />
          </div>
        </div>
      </div>
      <AddAccountDialog open={accountOpen} onOpenChange={closeAccountDialog} />
      <ManageAccountsDialog
        accounts={data.accounts}
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </TooltipProvider>
  );
}

function NoAccounts({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed border-primary/30 bg-primary/[.035] p-5 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-semibold">Start with a real account container</p>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
          Create a broker-import, demo, or funded account. MetaTradee will never invent a balance,
          position, or broker connection.
        </p>
      </div>
      <Button onClick={onAdd}>
        <Plus aria-hidden /> Add account
      </Button>
    </section>
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
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {cards.map((card, index) => (
          <li
            key={card.label}
            className="group min-h-28 rounded-xl border border-border/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.035)] transition duration-fast ease-standard hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{card.label}</span>
              <InfoTip>{card.info}</InfoTip>
            </div>
            <div className="mt-3 flex items-end justify-between">
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
                  index % 2 ? 'bg-blue-50 text-blue-600' : 'bg-primary/8 text-primary',
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
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <header className="flex h-14 items-center gap-2 border-b border-border px-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <InfoTip>{info}</InfoTip>
      </header>
      <div className="p-4">{children}</div>
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
      <div className="grid h-[255px] place-items-center text-center">
        <div className="max-w-xs">
          <div className="bg-primary/8 mx-auto grid size-12 place-items-center rounded-full text-primary">
            <LockKeyhole className="size-5" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-semibold">
            Score unlocks with {score.minimumTrades} closed trades
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            The score stays locked until every component has enough real trading data. No
            placeholder score is shown.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {labels.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/45 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="mt-1 text-xs font-semibold">
                  {value === null ? '—' : `${Math.round(value)} / 100`}
                </p>
              </div>
            ))}
          </div>
        </div>
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
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <Tabs defaultValue="positions">
        <div className="border-b border-border px-4">
          <TabsList className="h-14 bg-transparent p-0">
            <TabsTrigger
              value="positions"
              className="h-14 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Open positions{' '}
              <Badge variant="secondary" className="ml-1.5">
                {projection.openTrades.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="recent"
              className="h-14 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
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
  if (trades.length === 0)
    return (
      <div className="grid min-h-72 place-items-center px-6 text-center">
        <div>
          <p className="text-sm font-semibold">
            {open ? 'No open positions' : 'No recent closed trades'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {open
              ? 'Open journal positions will appear here. Live marks are shown only when supported.'
              : 'Closed trades matching the shared filters will appear here.'}
          </p>
        </div>
      </div>
    );
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[820px] text-xs">
        <thead>
          <tr className="bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">{open ? 'Opened' : 'Closed'}</th>
            <th className="px-3 py-3">Account</th>
            <th className="px-3 py-3">Symbol</th>
            <th className="px-3 py-3">Side</th>
            <th className="px-3 py-3 text-right">Qty</th>
            <th className="px-3 py-3 text-right">Entry</th>
            <th className="px-3 py-3 text-right">{open ? 'Latest' : 'Exit'}</th>
            <th className="px-3 py-3 text-right">{open ? 'Unrealized P&L' : 'Realized P&L'}</th>
            <th className="px-4 py-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-t border-border/80 hover:bg-muted/30">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {new Date(
                  (open ? trade.opened_at : trade.closed_at) || trade.created_at,
                ).toLocaleDateString()}
              </td>
              <td className="max-w-28 truncate px-3 py-3" title={accountName(trade)}>
                {accountName(trade)}
              </td>
              <td className="px-3 py-3 font-semibold">
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
              <td className="px-3 py-3 capitalize">{trade.direction}</td>
              <td className="px-3 py-3 text-right tabular-nums">{number(trade.quantity)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{number(trade.entry_price)}</td>
              <td className="px-3 py-3 text-right tabular-nums">
                {open ? <UnavailableMark /> : number(trade.exit_price)}
              </td>
              <td
                className={cn(
                  'px-3 py-3 text-right font-semibold tabular-nums',
                  !open && trade.net_pnl !== null && trade.net_pnl > 0
                    ? 'text-profit'
                    : !open && trade.net_pnl !== null && trade.net_pnl < 0
                      ? 'text-loss'
                      : '',
                )}
              >
                {open ? <UnavailableMark /> : money(trade.net_pnl, currency)}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="capitalize">
                  {accountSource(trade)}
                </Badge>
              </td>
            </tr>
          ))}
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

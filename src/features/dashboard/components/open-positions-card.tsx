'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TradingAccount } from '@/features/accounts/types';
import { cn } from '@/lib/utils';
import type { DashboardProjection, DashboardTrade } from '../types';
import { DashboardInfoTip } from './dashboard-info-tip';

const TAB_TRIGGER =
  'h-full rounded-none border-b-2 border-transparent px-1 text-xs font-semibold uppercase tracking-[0.08em] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

function number(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function money(value: number | null, currency: string): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function UnavailableMarketValue({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help text-muted-foreground" aria-label={`${label} unavailable`}>
          —
        </span>
      </TooltipTrigger>
      <TooltipContent>Unavailable without a supported live market-price feed.</TooltipContent>
    </Tooltip>
  );
}

export function OpenPositionsCard({
  projection,
  accounts,
}: {
  projection: DashboardProjection;
  accounts: TradingAccount[];
}) {
  const [view, setView] = useState<'open' | 'recent'>('open');
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const accountName = (trade: DashboardTrade) =>
    (trade.trading_account_id ? accountById.get(trade.trading_account_id)?.name : null) ||
    'Unassigned';

  return (
    <section
      className="overflow-hidden rounded-md border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]"
      aria-label="Open positions and recent trades"
      data-dashboard-card="open-positions"
    >
      <Tabs value={view} onValueChange={(value) => setView(value as 'open' | 'recent')}>
        <header className="flex h-[54px] items-center gap-2 border-b border-border/70 px-5">
          <TabsList className="h-full gap-5 bg-transparent p-0">
            <TabsTrigger value="open" className={TAB_TRIGGER}>
              Open Positions
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 justify-center px-1.5 text-[10px]"
              >
                {projection.openTrades.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="recent" className={TAB_TRIGGER}>
              Recent Trades
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 justify-center px-1.5 text-[10px]"
              >
                {projection.recentTrades.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto">
            <DashboardInfoTip label="About positions and recent trades">
              Open positions and the most recently closed trades matching the shared filters. Latest
              price and unrealized P&L stay unavailable until MetaTradee has a supported live
              market-price feed.
            </DashboardInfoTip>
          </div>
        </header>
        <TabsContent value="open" className="m-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[920px] text-xs">
            <thead>
              <tr className="bg-muted/35 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Opened</th>
                <th className="px-3 py-2.5">Account</th>
                <th className="px-3 py-2.5">Symbol</th>
                <th className="px-3 py-2.5">Side</th>
                <th className="px-3 py-2.5 text-right">Quantity</th>
                <th className="px-3 py-2.5 text-right">Average entry</th>
                <th className="px-3 py-2.5 text-right">Latest price</th>
                <th className="px-4 py-2.5 text-right">Unrealized P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {projection.openTrades.length === 0 ? (
                <tr className="border-t border-border/70">
                  <td colSpan={8} className="h-[150px] px-5 py-7 align-top">
                    <p className="text-xs font-medium">No open positions</p>
                    <p className="mt-1 max-w-md text-[11px] leading-5 text-muted-foreground">
                      Open journal positions matching the selected account and filters will appear
                      here.
                    </p>
                  </td>
                </tr>
              ) : (
                projection.openTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-t border-border/70 transition-colors duration-fast hover:bg-muted/25 motion-reduce:transition-none"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {new Date(trade.opened_at || trade.created_at).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="max-w-36 truncate px-3 py-2.5" title={accountName(trade)}>
                      {accountName(trade)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{trade.symbol}</td>
                    <td
                      className={cn(
                        'px-3 py-2.5 font-medium capitalize',
                        trade.direction === 'buy' ? 'text-profit' : 'text-loss',
                      )}
                    >
                      {trade.direction}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {number(trade.quantity)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {number(trade.entry_price)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <UnavailableMarketValue label="Latest price" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <UnavailableMarketValue label="Unrealized P&L" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="recent" className="m-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="bg-muted/35 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Closed</th>
                <th className="px-3 py-2.5">Account</th>
                <th className="px-3 py-2.5">Symbol</th>
                <th className="px-3 py-2.5">Side</th>
                <th className="px-3 py-2.5 text-right">Quantity</th>
                <th className="px-4 py-2.5 text-right">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {projection.recentTrades.length === 0 ? (
                <tr className="border-t border-border/70">
                  <td colSpan={6} className="h-[150px] px-5 py-7 align-top">
                    <p className="text-xs font-medium">No recent trades</p>
                    <p className="mt-1 max-w-md text-[11px] leading-5 text-muted-foreground">
                      Closed trades matching the selected account and filters will appear here, most
                      recently closed first.
                    </p>
                  </td>
                </tr>
              ) : (
                projection.recentTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-t border-border/70 transition-colors duration-fast hover:bg-muted/25 motion-reduce:transition-none"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {trade.closed_at
                        ? new Date(trade.closed_at).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="max-w-36 truncate px-3 py-2.5" title={accountName(trade)}>
                      {accountName(trade)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{trade.symbol}</td>
                    <td
                      className={cn(
                        'px-3 py-2.5 font-medium capitalize',
                        trade.direction === 'buy' ? 'text-profit' : 'text-loss',
                      )}
                    >
                      {trade.direction}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {number(trade.quantity)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right font-semibold tabular-nums',
                        trade.net_pnl !== null && trade.net_pnl > 0 && 'text-profit',
                        trade.net_pnl !== null && trade.net_pnl < 0 && 'text-loss',
                      )}
                    >
                      {money(trade.net_pnl, trade.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </section>
  );
}

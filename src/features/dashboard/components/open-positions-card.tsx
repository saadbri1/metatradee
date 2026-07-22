'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TradingAccount } from '@/features/accounts/types';
import { cn } from '@/lib/utils';
import type { DashboardProjection, DashboardTrade } from '../types';

const TAB_TRIGGER =
  'h-full rounded-none border-b-2 border-transparent px-1 text-[13px] font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

function money(value: number | null, currency: string): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function shortDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB').replace(/\//g, '-');
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

function EmptyRow({ title, detail }: { title: string; detail: string }) {
  return (
    <tr className="border-t border-border/70">
      <td colSpan={3} className="h-[150px] px-4 py-6 align-top">
        <p className="text-xs font-medium">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{detail}</p>
      </td>
    </tr>
  );
}

const HEAD_CELL = 'px-4 py-2.5 font-medium';

export function OpenPositionsCard({
  projection,
  accounts,
}: {
  projection: DashboardProjection;
  accounts: TradingAccount[];
}) {
  const [view, setView] = useState<'open' | 'recent'>('open');
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const currencyFor = (trade: DashboardTrade) =>
    trade.currency ||
    (trade.trading_account_id ? accountById.get(trade.trading_account_id)?.base_currency : null) ||
    'USD';

  return (
    <section
      className="flex h-full flex-col overflow-hidden rounded-md border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]"
      aria-label="Open positions and recent trades"
      data-dashboard-card="open-positions"
    >
      <Tabs
        value={view}
        onValueChange={(value) => setView(value as 'open' | 'recent')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <header className="flex h-[54px] shrink-0 items-center gap-5 border-b border-border/70 px-4">
          <TabsList className="h-full gap-5 bg-transparent p-0">
            <TabsTrigger value="open" className={TAB_TRIGGER}>
              Open Positions
            </TabsTrigger>
            <TabsTrigger value="recent" className={TAB_TRIGGER}>
              Recent Trades
            </TabsTrigger>
          </TabsList>
        </header>

        <TabsContent value="open" className="m-0 min-h-0 flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 text-left text-[11px] text-muted-foreground">
                <th className={HEAD_CELL}>Open Date</th>
                <th className={HEAD_CELL}>Symbol</th>
                <th className={cn(HEAD_CELL, 'text-right')}>Unrealized P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {projection.openTrades.length === 0 ? (
                <EmptyRow
                  title="No open positions"
                  detail="Open journal positions matching the selected account and filters will appear here."
                />
              ) : (
                projection.openTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-t border-border/70 transition-colors duration-fast hover:bg-muted/25 motion-reduce:transition-none"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {shortDate(trade.opened_at || trade.created_at)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold">{trade.symbol}</td>
                    <td className="px-4 py-2.5 text-right">
                      <UnavailableMarketValue label="Unrealized P&L" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="recent" className="m-0 min-h-0 flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 text-left text-[11px] text-muted-foreground">
                <th className={HEAD_CELL}>Close Date</th>
                <th className={HEAD_CELL}>Symbol</th>
                <th className={cn(HEAD_CELL, 'text-right')}>Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {projection.recentTrades.length === 0 ? (
                <EmptyRow
                  title="No recent trades"
                  detail="Closed trades matching the selected account and filters will appear here, most recently closed first."
                />
              ) : (
                projection.recentTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-t border-border/70 transition-colors duration-fast hover:bg-muted/25 motion-reduce:transition-none"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {shortDate(trade.closed_at)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold">{trade.symbol}</td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right font-semibold tabular-nums',
                        trade.net_pnl !== null && trade.net_pnl > 0 && 'text-profit',
                        trade.net_pnl !== null && trade.net_pnl < 0 && 'text-loss',
                      )}
                    >
                      {money(trade.net_pnl, currencyFor(trade))}
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

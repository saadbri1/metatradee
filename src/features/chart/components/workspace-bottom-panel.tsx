'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { CandleResponse } from '../api';
import type { Candle, CandleSummary } from '../types';
import type { ReplayState } from '@/features/replay';
import { currentTimestamp, progress } from '@/features/replay';
import {
  formatUsd,
  formatUsdAmount,
  type AccountingSnapshot,
  type DemoAccountSnapshot,
  type SimulationState,
} from '@/features/simulation';
import { OrdersTable } from '@/features/simulation/components/orders-panel';
import { CandleSummaryPanel } from './candle-summary';

export type WorkspaceTab =
  'trade_note' | 'daily_journal' | 'positions' | 'orders' | 'executions' | 'session';

const EMPTY_SIMULATION: SimulationState = {
  orders: [],
  fills: [],
  nextSequence: 1,
  currentCursor: 0,
  currentCandleTime: null,
};

function formatTime(seconds: number | null): string {
  return seconds === null
    ? '—'
    : `${new Date(seconds * 1000).toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

function ExecutionsTable({ state }: { state: SimulationState }) {
  return (
    <table aria-label="Simulation executions" className="w-full text-left text-xs">
      <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
        <tr>
          {['Order ID', 'Role', 'Side', 'Quantity', 'Fill price', 'Fill candle time'].map(
            (heading) => (
              <th key={heading} scope="col" className="px-3 py-2 font-medium">
                {heading}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {state.fills.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-5 text-center text-muted-foreground">
              No fills in this replay session.
            </td>
          </tr>
        ) : null}
        {state.fills.map((fill) => (
          <tr key={fill.sequence} className="transition-colors hover:bg-muted/20">
            <td className="px-3 py-1.5 font-mono">{fill.orderId}</td>
            <td className="px-3 py-1.5 capitalize">{fill.role.replace('_', ' ')}</td>
            <td className="px-3 py-1.5 capitalize">{fill.side}</td>
            <td className="tabular px-3 py-1.5">{fill.quantity}</td>
            <td className="tabular px-3 py-1.5">{fill.price}</td>
            <td className="tabular px-3 py-1.5">{formatTime(fill.candleTime)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The open-position table. One aggregate row sourced entirely from the
 * accounting fold plus the latest revealed price. Status text carries meaning
 * alongside colour.
 */
function PositionsSection({
  symbol,
  accounting,
  demoAccount,
}: {
  symbol: string | null;
  accounting: AccountingSnapshot | null;
  demoAccount: DemoAccountSnapshot | null;
}) {
  if (!accounting || accounting.fillCount === 0) {
    return (
      <div>
        <DemoAccountSummary account={demoAccount} />
        <div className="px-4 py-7 text-center">
          <p className="text-xs font-medium">No position activity in this replay session.</p>
          <p className="mx-auto mt-1 max-w-64 text-[10px] leading-relaxed text-muted-foreground">
            Fills from simulated orders build the position and its P&amp;L here, marked against the
            latest revealed candle.
          </p>
        </div>
      </div>
    );
  }
  const open = accounting.side !== 'flat';
  const pnlClass = (value: number | null) =>
    value === null || value === 0 ? 'text-foreground' : value > 0 ? 'text-profit' : 'text-loss';
  const headers = [
    'Symbol',
    'Side',
    'Quantity',
    'Average entry',
    'Current price',
    'Unrealized P&L',
    'Realized P&L',
    'Status',
  ];
  return (
    <div>
      <DemoAccountSummary account={demoAccount} />
      <table aria-label="Replay position" className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
          <tr>
            {headers.map((heading) => (
              <th key={heading} scope="col" className="px-3 py-2 font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-3 py-1.5 font-medium">{symbol ?? '—'}</td>
            <td
              className={
                'px-3 py-1.5 font-semibold ' +
                (accounting.side === 'long'
                  ? 'text-profit'
                  : accounting.side === 'short'
                    ? 'text-loss'
                    : 'text-foreground')
              }
            >
              {accounting.side.toUpperCase()}
            </td>
            <td className="tabular px-3 py-1.5">{open ? accounting.quantity : '—'}</td>
            <td className="tabular px-3 py-1.5">
              {accounting.averageEntryPrice != null
                ? accounting.averageEntryPrice.toLocaleString('en-US', {
                    maximumFractionDigits: 8,
                  })
                : '—'}
            </td>
            <td className="tabular px-3 py-1.5">
              {accounting.markPrice != null
                ? accounting.markPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })
                : '—'}
            </td>
            <td className={'tabular px-3 py-1.5 ' + pnlClass(accounting.unrealizedPnl)}>
              {accounting.unrealizedPnl != null ? formatUsd(accounting.unrealizedPnl) : '—'}
            </td>
            <td className={'tabular px-3 py-1.5 ' + pnlClass(accounting.realizedPnl)}>
              {formatUsd(accounting.realizedPnl)}
            </td>
            <td className="px-3 py-1.5 text-muted-foreground">{open ? 'Open' : 'Closed'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DemoAccountSummary({ account }: { account: DemoAccountSnapshot | null }) {
  if (!account) return null;
  return (
    <dl
      aria-label="Simulated demo account"
      className="grid grid-cols-2 border-b border-border sm:grid-cols-4"
    >
      {[
        ['Starting balance', formatUsdAmount(account.startingBalance)],
        ['Demo balance', formatUsdAmount(account.balance)],
        ['Equity', formatUsdAmount(account.equity)],
        ['Total P&L', formatUsd(account.totalPnl)],
      ].map(([label, value]) => (
        <div key={label} className="border-r border-border px-3 py-2 last:border-r-0">
          <dt className="text-[10px] text-muted-foreground">{label}</dt>
          <dd className="tabular mt-0.5 text-xs font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SessionDetails({
  response,
  replay,
  simulation,
  demoAccount,
}: {
  response: CandleResponse | null;
  replay: ReplayState;
  simulation: SimulationState | null;
  demoAccount: DemoAccountSnapshot | null;
}) {
  const replayProgress = progress(replay);
  const activeOrders =
    simulation?.orders.filter((order) => order.status === 'pending' || order.status === 'working')
      .length ?? 0;
  const rows: Array<[string, string]> = [
    ['Contract', response?.symbol ?? '—'],
    ['Timeframe', response?.timeframe ?? '—'],
    ['Loaded UTC range', response ? `${response.start} → ${response.end}` : '—'],
    ['Source', response ? `${response.provider} · real historical data` : '—'],
    ['Candle count', response ? String(response.candles.length) : '—'],
    [
      'Replay progress',
      replay.status === 'idle'
        ? 'Not active'
        : `${replayProgress.current} of ${replayProgress.total}`,
    ],
    ['Cursor time', formatTime(currentTimestamp(replay))],
    ['Replay status', replay.status],
    ['Working orders', String(activeOrders)],
    ['Fills', String(simulation?.fills.length ?? 0)],
    ['Account mode', demoAccount ? 'Simulated · browser session' : 'Not active'],
    ['Demo balance', demoAccount ? formatUsdAmount(demoAccount.balance) : '—'],
    ['Equity', demoAccount ? formatUsdAmount(demoAccount.equity) : '—'],
  ];
  return (
    <dl className="grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2 xl:grid-cols-5">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0 border-b border-border/60 py-1">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular truncate text-foreground" title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function NoteEditor({
  id,
  title,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex min-h-32 flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id={`${id}-heading`} className="flex items-center gap-1.5 text-xs font-medium">
            <FileText className="size-3.5 text-primary" aria-hidden />
            {title}
          </h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Session notes are not saved yet.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{value.length} characters</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            disabled={value.length === 0}
            onClick={() => onChange('')}
          >
            <Trash2 className="size-3" aria-hidden />
            Clear
          </Button>
        </div>
      </div>
      <Textarea
        id={id}
        aria-label={title}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-20 flex-1 resize-none border-border bg-background text-xs leading-relaxed"
      />
    </section>
  );
}

/** One running-results figure: quiet label above a prominent value. */
function Result({ label, value, tone }: { label: string; value: string; tone?: 'buy' | 'sell' }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <p
        className={
          'tabular mt-0.5 truncate text-xs font-medium ' +
          (tone === 'buy' ? 'text-profit' : tone === 'sell' ? 'text-loss' : 'text-foreground')
        }
      >
        {value}
      </p>
    </div>
  );
}

function RunningResults({
  state,
  accounting,
  demoAccount,
}: {
  state: SimulationState;
  accounting: AccountingSnapshot | null;
  demoAccount: DemoAccountSnapshot | null;
}) {
  const working = state.orders.filter(
    (order) => order.status === 'pending' || order.status === 'working',
  );
  const latest = state.fills.at(-1);
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-border px-3 py-2">
      <Result label="Working orders" value={String(working.length)} />
      <Result label="Executions" value={String(state.fills.length)} />
      <Result
        label="Demo balance"
        value={demoAccount ? formatUsdAmount(demoAccount.balance) : '—'}
      />
      <Result label="Equity" value={demoAccount ? formatUsdAmount(demoAccount.equity) : '—'} />
      <Result
        label="Latest execution"
        value={latest ? `${latest.side.toUpperCase()} ${latest.quantity} @ ${latest.price}` : '—'}
        tone={latest ? (latest.side === 'buy' ? 'buy' : 'sell') : undefined}
      />
      <Result
        label="Position"
        value={accounting ? `${accounting.side.toUpperCase()} ${accounting.quantity}` : 'FLAT 0'}
      />
      <Result
        label="Realized P&L"
        value={formatUsd(accounting?.realizedPnl ?? 0)}
        tone={
          (accounting?.realizedPnl ?? 0) > 0
            ? 'buy'
            : (accounting?.realizedPnl ?? 0) < 0
              ? 'sell'
              : undefined
        }
      />
      <Result
        label="Unrealized P&L"
        value={formatUsd(accounting?.unrealizedPnl ?? 0)}
        tone={
          (accounting?.unrealizedPnl ?? 0) > 0
            ? 'buy'
            : (accounting?.unrealizedPnl ?? 0) < 0
              ? 'sell'
              : undefined
        }
      />
    </div>
  );
}

export function WorkspaceBottomPanel({
  value,
  onValueChange,
  collapsed,
  onCollapsedChange,
  response,
  candles,
  summary,
  replay,
  simulation,
  accounting,
  demoAccount,
  tradeNote,
  onTradeNoteChange,
  dailyJournal,
  onDailyJournalChange,
  onCancelOrder,
}: {
  value: WorkspaceTab;
  onValueChange: (value: WorkspaceTab) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  response: CandleResponse | null;
  candles: readonly Candle[];
  summary: CandleSummary;
  replay: ReplayState;
  simulation: SimulationState | null;
  accounting: AccountingSnapshot | null;
  demoAccount: DemoAccountSnapshot | null;
  tradeNote: string;
  onTradeNoteChange: (value: string) => void;
  dailyJournal: string;
  onDailyJournalChange: (value: string) => void;
  onCancelOrder: (id: string) => void;
}) {
  const state = simulation ?? EMPTY_SIMULATION;
  const [resultsCollapsed, setResultsCollapsed] = useState(true);

  return (
    <section
      aria-label="Trading workspace details"
      data-state={collapsed ? 'collapsed' : 'expanded'}
      /*
       * Solid surface with a hairline top border. The previous heavy upward
       * shadow was a dark-workspace device: on light neutrals it renders as a
       * grey smear rather than depth, and separation only needs one line.
       */
      className="flex min-h-0 flex-col overflow-hidden border-t border-border bg-card"
    >
      <section
        aria-label="Charts and running results"
        hidden={collapsed}
        className="shrink-0 border-b border-border"
      >
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 bg-muted/15 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] hover:bg-muted/25"
          onClick={() => setResultsCollapsed((current) => !current)}
          aria-expanded={!resultsCollapsed}
        >
          {resultsCollapsed ? (
            <ChevronUp className="size-3" aria-hidden />
          ) : (
            <ChevronDown className="size-3" aria-hidden />
          )}
          Charts &amp; running results
          <span className="ml-auto font-normal normal-case tracking-normal text-muted-foreground">
            {state.orders.length} orders · {state.fills.length} executions
          </span>
        </button>
        {!resultsCollapsed ? (
          <RunningResults state={state} accounting={accounting} demoAccount={demoAccount} />
        ) : null}
      </section>

      <Tabs
        value={value}
        onValueChange={(next) => onValueChange(next as WorkspaceTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex min-h-9 shrink-0 items-center border-b border-border px-1">
          <TabsList className="h-8 justify-start overflow-x-auto rounded-none bg-transparent p-0">
            {(
              [
                ['trade_note', 'Trade note'],
                ['daily_journal', 'Daily journal'],
                ['positions', 'Positions'],
                ['orders', `Orders ${state.orders.length}`],
                ['executions', `Executions ${state.fills.length}`],
                ['session', 'Session'],
              ] as const
            ).map(([tab, label]) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="h-8 shrink-0 rounded-none border-b-2 border-transparent px-3 text-[11px] shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-8 shrink-0"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Expand bottom panel' : 'Collapse bottom panel'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          </Button>
        </div>

        {!collapsed ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <TabsContent value="trade_note" className="m-0">
              <NoteEditor
                id="trade-note"
                title="Trade note"
                placeholder="Record the setup, execution plan, and observations for this replay."
                value={tradeNote}
                onChange={onTradeNoteChange}
              />
            </TabsContent>
            <TabsContent value="daily_journal" className="m-0">
              <NoteEditor
                id="daily-journal"
                title="Daily journal"
                placeholder="Capture broader lessons from this browser session."
                value={dailyJournal}
                onChange={onDailyJournalChange}
              />
            </TabsContent>
            <TabsContent value="positions" className="m-0 overflow-auto">
              <PositionsSection
                symbol={response?.symbol ?? null}
                accounting={accounting}
                demoAccount={demoAccount}
              />
            </TabsContent>

            <TabsContent value="orders" className="m-0">
              <OrdersTable state={state} onCancel={onCancelOrder} />
            </TabsContent>
            <TabsContent value="executions" className="m-0">
              <ExecutionsTable state={state} />
            </TabsContent>
            <TabsContent value="session" className="m-0 space-y-3 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-medium">Loaded session</h3>
                  <p className="text-[10px] text-muted-foreground">
                    Provider, replay, simulation, and deterministic fill-accounting facts only.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ShieldCheck className="size-3" aria-hidden />
                  Deterministic browser session
                </span>
              </div>
              <SessionDetails
                response={response}
                replay={replay}
                simulation={simulation}
                demoAccount={demoAccount}
              />
              {response ? (
                <CandleSummaryPanel
                  candles={[...candles]}
                  summary={summary}
                  symbol={response.symbol}
                />
              ) : null}
            </TabsContent>
          </div>
        ) : null}
      </Tabs>
      <p className="sr-only" aria-live="polite">
        Bottom panel {collapsed ? 'collapsed' : 'expanded'}.
      </p>
    </section>
  );
}

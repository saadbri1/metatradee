'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { CandleResponse } from '../api';
import type { Candle, CandleSummary } from '../types';
import type { ReplayState } from '@/features/replay';
import { currentTimestamp, progress } from '@/features/replay';
import type { SimulationState } from '@/features/simulation';
import { OrdersTable } from '@/features/simulation/components/orders-panel';
import { CandleSummaryPanel } from './candle-summary';

export type WorkspaceTab = 'trade_note' | 'daily_journal' | 'orders' | 'executions' | 'session';

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

function SessionDetails({
  response,
  replay,
  simulation,
}: {
  response: CandleResponse | null;
  replay: ReplayState;
  simulation: SimulationState | null;
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

function RunningResults({ state }: { state: SimulationState }) {
  const working = state.orders.filter(
    (order) => order.status === 'pending' || order.status === 'working',
  );
  const latest = state.fills.at(-1);
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-border px-3 py-2">
      <Result label="Working orders" value={String(working.length)} />
      <Result label="Executions" value={String(state.fills.length)} />
      <Result
        label="Latest execution"
        value={latest ? `${latest.side.toUpperCase()} ${latest.quantity} @ ${latest.price}` : '—'}
        tone={latest ? (latest.side === 'buy' ? 'buy' : 'sell') : undefined}
      />
      {/*
        One quiet line, not a row of placeholders: running P&L needs closed
        position accounting, which does not exist. Stating the dependency is
        honest; printing "—" under a "P&L" heading would imply it is merely
        empty rather than uncomputed.
      */}
      <p className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Lock className="size-3" aria-hidden />
        Running P&amp;L available after execution accounting
      </p>
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
      <section aria-label="Charts and running results" className="shrink-0 border-b border-border">
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
        {!resultsCollapsed ? <RunningResults state={state} /> : null}
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
                    Provider, replay, and simulation facts only. No positions or P&amp;L are
                    inferred.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ShieldCheck className="size-3" aria-hidden />
                  Deterministic browser session
                </span>
              </div>
              <SessionDetails response={response} replay={replay} simulation={simulation} />
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

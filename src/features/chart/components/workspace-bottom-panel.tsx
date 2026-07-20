'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ShieldCheck, Trash2 } from 'lucide-react';
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

export type WorkspaceTab = 'orders' | 'executions' | 'journal' | 'session';

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
    ['Active orders', String(activeOrders)],
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

function SessionJournal({
  thesis,
  review,
  onThesisChange,
  onReviewChange,
  onClear,
}: {
  thesis: string;
  review: string;
  onThesisChange: (value: string) => void;
  onReviewChange: (value: string) => void;
  onClear: () => void;
}) {
  const hasNotes = thesis.trim() !== '' || review.trim() !== '';

  return (
    <section aria-label="Session journal" className="grid min-h-32 gap-3 p-3 lg:grid-cols-2">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="replay-thesis" className="text-xs font-medium">
            Replay thesis
          </label>
          <span className="inline-flex items-center gap-1 text-[10px] text-warning">
            <ShieldCheck className="size-3" aria-hidden />
            Session only · Not saved
          </span>
        </div>
        <Textarea
          id="replay-thesis"
          value={thesis}
          onChange={(event) => onThesisChange(event.target.value)}
          placeholder="What setup, level, or behavior are you reviewing?"
          className="min-h-20 resize-y rounded-none bg-background/40 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="replay-review" className="text-xs font-medium">
            Execution review
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[10px]"
            disabled={!hasNotes}
            onClick={onClear}
          >
            <Trash2 className="size-3" aria-hidden />
            Clear notes
          </Button>
        </div>
        <Textarea
          id="replay-review"
          value={review}
          onChange={(event) => onReviewChange(event.target.value)}
          placeholder="Record execution quality, mistakes, and the next adjustment."
          className="min-h-20 resize-y rounded-none bg-background/40 text-xs"
        />
      </div>
    </section>
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
  onCancelOrder: (id: string) => void;
}) {
  const state = simulation ?? EMPTY_SIMULATION;
  const [journalThesis, setJournalThesis] = useState('');
  const [journalReview, setJournalReview] = useState('');
  return (
    <section
      aria-label="Trading workspace details"
      data-state={collapsed ? 'collapsed' : 'expanded'}
      className="min-h-0 overflow-hidden border-x border-b border-border bg-card/95 shadow-[0_-10px_30px_hsl(var(--background)/0.18)]"
    >
      <Tabs
        value={value}
        onValueChange={(next) => onValueChange(next as WorkspaceTab)}
        className="flex h-full min-h-0 flex-col"
      >
        <div className="flex min-h-9 items-center border-b border-border bg-muted/20 px-1">
          <TabsList className="h-8 justify-start rounded-none bg-transparent p-0">
            <TabsTrigger
              value="orders"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Orders <span className="ml-1 text-muted-foreground">{state.orders.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="executions"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Executions <span className="ml-1 text-muted-foreground">{state.fills.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="journal"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <BookOpen className="mr-1 size-3" aria-hidden />
              Journal
            </TabsTrigger>
            <TabsTrigger
              value="session"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Session
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-8"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Expand bottom panel' : 'Collapse bottom panel'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          </Button>
        </div>

        {!collapsed ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <TabsContent value="orders" className="m-0">
              <OrdersTable state={state} onCancel={onCancelOrder} />
            </TabsContent>
            <TabsContent value="executions" className="m-0">
              <table aria-label="Simulation executions" className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-muted/80 text-muted-foreground backdrop-blur-sm">
                  <tr>
                    {['Order ID', 'Side', 'Quantity', 'Fill price', 'Fill candle time'].map(
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
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        No fills in this replay session.
                      </td>
                    </tr>
                  ) : null}
                  {state.fills.map((fill) => (
                    <tr key={fill.sequence} className="transition-colors hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-mono">{fill.orderId}</td>
                      <td className="px-3 py-1.5 capitalize">{fill.side}</td>
                      <td className="tabular px-3 py-1.5">{fill.quantity}</td>
                      <td className="tabular px-3 py-1.5">{fill.price}</td>
                      <td className="tabular px-3 py-1.5">{formatTime(fill.candleTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>
            <TabsContent value="journal" className="m-0">
              <SessionJournal
                thesis={journalThesis}
                review={journalReview}
                onThesisChange={setJournalThesis}
                onReviewChange={setJournalReview}
                onClear={() => {
                  setJournalThesis('');
                  setJournalReview('');
                }}
              />
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

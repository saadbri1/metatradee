'use client';

import { BookOpen, ClipboardList, FileText, Gauge, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CandleResponse } from '../api';
import { progress, type ReplayState } from '@/features/replay';
import type { SimulatedFill, SimulationState } from '@/features/simulation';

function formatPrice(value: number | undefined): string {
  return value === undefined
    ? 'Not available yet'
    : value.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatTime(seconds: number): string {
  return `${new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/60 py-2 last:border-b-0">
      <dt className="text-[9px] font-medium uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-xs font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ExecutionList({ fills }: { fills: readonly SimulatedFill[] }) {
  if (fills.length === 0) {
    return (
      <div className="p-4 text-center text-xs leading-relaxed text-muted-foreground">
        No executions in this replay session.
      </div>
    );
  }
  return (
    <ol className="divide-y divide-border">
      {fills.map((fill) => (
        <li key={fill.sequence} className="space-y-1 px-3 py-2 text-[10px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-foreground">{fill.orderId}</span>
            <span className="capitalize text-muted-foreground">{fill.role.replace('_', ' ')}</span>
          </div>
          <div className="tabular flex items-center justify-between gap-2">
            <span className={fill.side === 'buy' ? 'text-primary' : 'text-destructive'}>
              {fill.side.toUpperCase()} {fill.quantity}
            </span>
            <span>@ {formatPrice(fill.price)}</span>
          </div>
          <time className="block text-muted-foreground">{formatTime(fill.candleTime)}</time>
        </li>
      ))}
    </ol>
  );
}

export function WorkspaceContextPanel({
  open,
  onOpenChange,
  response,
  replay,
  simulation,
  playbookNote,
  onPlaybookNoteChange,
  contextNote,
  onContextNoteChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  response: CandleResponse | null;
  replay: ReplayState;
  simulation: SimulationState | null;
  playbookNote: string;
  onPlaybookNoteChange: (value: string) => void;
  contextNote: string;
  onContextNoteChange: (value: string) => void;
}) {
  const state = simulation;
  const fills = state?.fills ?? [];
  const entry = fills.find((fill) => fill.role === 'entry');
  const exit = [...fills].reverse().find((fill) => fill.role !== 'entry');
  const replayProgress = progress(replay);
  const workingOrders =
    state?.orders.filter((order) => order.status === 'pending' || order.status === 'working')
      .length ?? 0;
  const contractsTraded = fills.reduce((total, fill) => total + fill.quantity, 0);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close session context overlay"
          className="fixed inset-0 z-40 bg-background/65 backdrop-blur-[1px] lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <aside
        aria-label="Session context"
        hidden={!open}
        data-state={open ? 'open' : 'closed'}
        data-responsive="desktop-panel medium-drawer small-bottom-sheet"
        className={cn(
          'z-50 min-h-0 w-64 shrink-0 overflow-hidden border-r border-border bg-card/95 shadow-xl',
          'fixed bottom-0 left-0 top-0 lg:relative lg:z-auto lg:flex lg:shadow-none',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:h-[min(76dvh,38rem)] max-sm:w-full max-sm:border-r-0 max-sm:border-t',
        )}
      >
        <Tabs defaultValue="stats" className="flex h-full min-h-0 flex-col">
          <div className="flex h-11 shrink-0 items-center border-b border-border px-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em]">Session context</h2>
              <p className="text-[9px] text-muted-foreground">Real replay and execution state</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-7"
              onClick={() => onOpenChange(false)}
              aria-label="Hide session context"
            >
              <X aria-hidden />
            </Button>
          </div>
          <TabsList className="h-9 w-full shrink-0 justify-start rounded-none border-b border-border bg-muted/20 p-0">
            {(
              [
                ['stats', 'Stats', Gauge],
                ['playbook', 'Playbook', BookOpen],
                ['executions', 'Executions', ClipboardList],
                ['notes', 'Notes', FileText],
              ] as const
            ).map(([value, label, Icon]) => (
              <TabsTrigger
                key={String(value)}
                value={String(value)}
                className="h-9 min-w-0 flex-1 rounded-none border-b-2 border-transparent px-1 text-[9px] shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Icon className="mr-1 size-3" aria-hidden />
                {String(label)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="stats" className="m-0 p-3">
              <dl>
                <Stat label="Contract" value={response?.symbol ?? 'Not available yet'} />
                <Stat
                  label="Direction"
                  value={entry ? entry.side.toUpperCase() : 'Not available yet'}
                />
                <Stat label="Contracts traded" value={String(contractsTraded)} />
                <Stat
                  label="Entry"
                  value={
                    entry
                      ? `${formatPrice(entry.price)} · ${formatTime(entry.candleTime)}`
                      : 'Not available yet'
                  }
                />
                <Stat
                  label="Exit"
                  value={
                    exit
                      ? `${formatPrice(exit.price)} · ${formatTime(exit.candleTime)}`
                      : 'Not available yet'
                  }
                />
                <Stat
                  label="Replay progress"
                  value={
                    replay.status === 'idle'
                      ? 'Not active'
                      : `${replayProgress.current} / ${replayProgress.total}`
                  }
                />
                <Stat label="Working orders" value={String(workingOrders)} />
                <Stat label="Fill count" value={String(fills.length)} />
                <Stat
                  label="Loaded date"
                  value={response ? response.start.slice(0, 10) : 'Not available yet'}
                />
                <Stat label="Timeframe" value={response?.timeframe ?? 'Not available yet'} />
              </dl>
              <div className="mt-3 border border-dashed border-border bg-muted/15 p-2.5">
                <p className="text-[10px] font-medium">Position and P&amp;L metrics</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Not available yet.</p>
              </div>
            </TabsContent>

            <TabsContent value="playbook" className="m-0 space-y-2 p-3">
              <label htmlFor="session-playbook" className="text-xs font-medium">
                Session playbook
              </label>
              <Textarea
                id="session-playbook"
                value={playbookNote}
                onChange={(event) => onPlaybookNoteChange(event.target.value)}
                placeholder="Record the setup and conditions you intend to review."
                className="min-h-40 resize-none rounded-none bg-background/50 text-xs"
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Session notes are not saved yet.
              </p>
            </TabsContent>

            <TabsContent value="executions" className="m-0">
              <ExecutionList fills={fills} />
            </TabsContent>

            <TabsContent value="notes" className="m-0 space-y-2 p-3">
              <label htmlFor="context-note" className="text-xs font-medium">
                Review notes
              </label>
              <Textarea
                id="context-note"
                value={contextNote}
                onChange={(event) => onContextNoteChange(event.target.value)}
                placeholder="Capture observations from this replay."
                className="min-h-40 resize-none rounded-none bg-background/50 text-xs"
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Session notes are not saved yet.
              </p>
            </TabsContent>
          </div>
        </Tabs>
      </aside>
    </>
  );
}

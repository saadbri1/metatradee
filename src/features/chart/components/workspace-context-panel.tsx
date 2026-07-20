'use client';

/**
 * Session context panel — the workspace's statistics surface.
 *
 * HONESTY RULE: every value here is derived from real loaded response, replay,
 * or simulation state. Metrics the product cannot compute yet (P&L, MAE/MFE,
 * R-multiple, risk, rating, open positions) are NOT rendered as rows with
 * placeholder text — they live in a single designed locked section, so the
 * panel never reads as a wall of "not available". An unset real value shows an
 * em dash, the ordinary typographic convention for "no value", which cannot be
 * mistaken for a number.
 */
import { BookOpen, ClipboardList, FileText, Gauge, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CandleResponse } from '../api';
import { progress, type ReplayState } from '@/features/replay';
import type { SimulatedFill, SimulationState } from '@/features/simulation';

/** No value yet. An em dash, never invented text that could read as data. */
const NONE = '—';

function formatPrice(value: number | undefined): string {
  return value === undefined ? NONE : value.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatTime(seconds: number): string {
  return `${new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * One metric row: label left, value right, on a single line. The panel is wide
 * enough (Slice 2) that this holds without wrapping, which is what makes a
 * statistics panel scannable — the eye runs down the value column.
 */
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'buy' | 'sell' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'tabular min-w-0 truncate text-right text-[11px] font-medium',
          tone === 'buy' && 'text-profit',
          tone === 'sell' && 'text-loss',
          !tone && (value === NONE ? 'text-muted-foreground' : 'text-foreground'),
        )}
        title={value === NONE ? undefined : value}
      >
        {value}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border/70 px-3 py-2 last:border-b-0">
      <h3 className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/80">
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

/**
 * The single locked block. Naming the metrics that are coming is more useful
 * — and more honest — than repeating a placeholder on each of them, because it
 * states plainly what the gate is: these need execution accounting, which does
 * not exist yet.
 */
function LockedMetrics() {
  return (
    <div className="m-3 border border-border bg-muted/25 p-3">
      <div className="flex items-center gap-1.5">
        <Lock className="size-3 text-muted-foreground" aria-hidden />
        <p className="text-[11px] font-medium">Available after execution accounting</p>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        Net and gross P&amp;L, MAE/MFE, R-multiple, risk, open positions, and trade rating are
        computed from closed-position accounting. That engine is not built yet, so no values are
        shown here.
      </p>
    </div>
  );
}

function ExecutionList({ fills }: { fills: readonly SimulatedFill[] }) {
  if (fills.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[11px] font-medium">No executions in this replay session.</p>
        <p className="mx-auto mt-1 max-w-[15rem] text-[10px] leading-relaxed text-muted-foreground">
          Orders placed during replay fill deterministically as candles are revealed, and appear
          here.
        </p>
      </div>
    );
  }
  return (
    <ol className="divide-y divide-border/70">
      {fills.map((fill) => (
        <li key={fill.sequence} className="px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'tabular text-[11px] font-semibold',
                fill.side === 'buy' ? 'text-profit' : 'text-loss',
              )}
            >
              {fill.side.toUpperCase()} {fill.quantity}
            </span>
            <span className="tabular text-[11px] font-medium">@ {formatPrice(fill.price)}</span>
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[10px] text-muted-foreground">
            <time>{formatTime(fill.candleTime)}</time>
            <span className="capitalize">{fill.role.replace('_', ' ')}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SessionNote({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <label htmlFor={id} className="text-[11px] font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-44 flex-1 resize-none bg-background text-[11px] leading-relaxed"
      />
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Session notes are not saved yet.
      </p>
    </div>
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
          /*
           * ~352px (xl: ~376px). A statistics panel has to hold a label and a
           * right-aligned value on one line without either truncating; at the
           * previous 256px the longer metric rows wrapped, which is what made
           * the panel read as a cramped sidebar rather than a journal surface.
           * Still a minority of a 1600px viewport, so the chart stays dominant.
           */
          'z-50 min-h-0 w-[22rem] shrink-0 overflow-hidden border-r border-border bg-card xl:w-[23.5rem]',
          'fixed bottom-0 left-0 top-0 lg:relative lg:z-auto lg:flex lg:shadow-none',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:h-[min(76dvh,38rem)] max-sm:w-full max-sm:border-r-0 max-sm:border-t',
        )}
      >
        <Tabs defaultValue="stats" className="flex h-full min-h-0 flex-col">
          <div className="flex h-11 shrink-0 items-center border-b border-border px-3">
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
          <TabsList className="h-9 w-full shrink-0 justify-start rounded-none border-b border-border bg-transparent p-0">
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
                className="h-9 min-w-0 flex-1 rounded-none border-b-2 border-transparent px-1 text-[10px] shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <Icon className="mr-1 size-3" aria-hidden />
                {String(label)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="stats" className="m-0">
              <Section title="Session">
                <Stat label="Contract" value={response?.symbol ?? NONE} />
                <Stat label="Timeframe" value={response?.timeframe ?? NONE} />
                <Stat label="Session date" value={response ? response.start.slice(0, 10) : NONE} />
                <Stat
                  label="Replay progress"
                  value={
                    replay.status === 'idle'
                      ? NONE
                      : `${replayProgress.current} / ${replayProgress.total}`
                  }
                />
              </Section>

              <Section title="Execution">
                <Stat
                  label="Direction"
                  value={entry ? entry.side.toUpperCase() : NONE}
                  tone={entry ? (entry.side === 'buy' ? 'buy' : 'sell') : undefined}
                />
                <Stat
                  label="Contracts traded"
                  value={contractsTraded ? String(contractsTraded) : NONE}
                />
                <Stat label="Entry" value={entry ? formatPrice(entry.price) : NONE} />
                <Stat label="Entry time" value={entry ? formatTime(entry.candleTime) : NONE} />
                <Stat label="Exit" value={exit ? formatPrice(exit.price) : NONE} />
                <Stat label="Exit time" value={exit ? formatTime(exit.candleTime) : NONE} />
                <Stat label="Working orders" value={String(workingOrders)} />
                <Stat label="Executions" value={String(fills.length)} />
              </Section>

              <LockedMetrics />
            </TabsContent>

            <TabsContent value="playbook" className="m-0 h-full">
              <SessionNote
                id="session-playbook"
                label="Session playbook"
                placeholder="Record the setup and conditions you intend to review."
                value={playbookNote}
                onChange={onPlaybookNoteChange}
              />
            </TabsContent>

            <TabsContent value="executions" className="m-0">
              <ExecutionList fills={fills} />
            </TabsContent>

            <TabsContent value="notes" className="m-0 h-full">
              <SessionNote
                id="context-note"
                label="Review notes"
                placeholder="Capture observations from this replay."
                value={contextNote}
                onChange={onContextNoteChange}
              />
            </TabsContent>
          </div>
        </Tabs>
      </aside>
    </>
  );
}

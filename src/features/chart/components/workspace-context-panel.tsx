'use client';

/**
 * Trade review panel — compact light surface inside the dark terminal.
 *
 * THEME: the whole /chart workspace is light-scoped at its root, so this
 * panel simply inherits it. It carries no theme class of its own.
 *
 * HONESTY RULE: a metric without an engine keeps its row and its exact visual
 * footprint but renders a quiet placeholder — never a number. Every control
 * either works, or is disabled with an accessible reason. There are no
 * decorative affordances that look clickable and do nothing.
 *
 * All figures arrive as props from the pure accounting fold; no financial
 * calculation happens in this file.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Lightbulb, Repeat, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CandleResponse } from '../api';
import { progress, type ReplayState } from '@/features/replay';
import {
  formatUsd,
  type AccountingSnapshot,
  type DemoAccountSnapshot,
  type SimulatedFill,
  type SimulationState,
} from '@/features/simulation';

const NONE = '—';

const NO_MODIFY =
  'This price comes from the working bracket order. Order modification is not supported, so cancel the order and place a new one to change it.';

/** Session-only vocabularies. Generic trading terms, not persisted anywhere. */
const MISTAKE_OPTIONS = [
  'Late entry',
  'Chased price',
  'Moved stop',
  'Oversized',
  'No plan',
  'Hesitated',
] as const;
const HABIT_OPTIONS = [
  'Had a game plan',
  'Respected stop',
  'Waited for setup',
  'Journaled',
] as const;
const SETUP_OPTIONS = ['Pullback', 'Breakout', 'Reversal', 'Range', 'Trend continuation'] as const;

function formatPrice(value: number | null | undefined): string {
  return value === null || value === undefined
    ? NONE
    : value.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatClock(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(11, 19);
}

function pnlTone(value: number | null | undefined): string {
  return value === null || value === undefined || value === 0
    ? 'text-foreground'
    : value > 0
      ? 'text-profit'
      : 'text-loss';
}

/** One metric line: fixed label column, value column immediately after it. */
function MetricRow({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex min-h-7 items-center gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="w-[9rem] shrink-0 text-[12px] text-primary/70">
          {label}
        </label>
      ) : (
        <dt className="w-[9rem] shrink-0 text-[12px] text-primary/70">{label}</dt>
      )}
      <dd className="min-w-0 flex-1 text-[12px] font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** Value column for a metric whose engine does not exist yet. */
function LockedMetricValue({ reason }: { reason: string }) {
  return (
    <span className="text-[12px] text-muted-foreground/60" title={reason}>
      {NONE}
      <span className="sr-only">Not calculated — {reason}</span>
    </span>
  );
}

/** Read-only bracket price. Never focusable — there is nothing to edit. */
function PriceField({
  id,
  name,
  value,
  reason,
}: {
  id: string;
  name: string;
  value: number | null;
  reason: string;
}) {
  return (
    <div
      id={id}
      role="group"
      aria-label={`${name}. ${reason}`}
      title={reason}
      aria-disabled="true"
      className="flex h-[2.1rem] w-[9rem] items-center rounded-md border border-input bg-card"
    >
      <span aria-hidden className="pl-2 pr-1 text-[11px] text-muted-foreground">
        $
      </span>
      <span className="tabular truncate pr-2 text-[12px] font-medium text-foreground">
        {value === null ? NONE : String(value)}
      </span>
    </div>
  );
}

function ExcursionValue({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={reason}>
      <span className="tabular rounded bg-loss/10 px-1.5 py-0.5 text-[11px] font-medium text-loss">
        {NONE}
      </span>
      <span className="text-muted-foreground/50">/</span>
      <span className="tabular rounded bg-profit/10 px-1.5 py-0.5 text-[11px] font-medium text-profit">
        {NONE}
      </span>
      <span className="sr-only">Not calculated — {reason}</span>
    </span>
  );
}

/** Stars render as static graphics when no rating store exists — not buttons. */
function RatingControl({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={reason} aria-disabled="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} aria-hidden className="size-3.5 fill-muted text-muted-foreground/30" />
      ))}
      <span className="sr-only">Trade rating not available — {reason}</span>
    </span>
  );
}

function QualityScale({ reason }: { reason: string }) {
  return (
    <span className="flex w-[9rem] items-center" title={reason} aria-disabled="true">
      <span className="h-1 w-full rounded-full bg-loss/20" />
      <span className="sr-only">Execution quality not available — {reason}</span>
    </span>
  );
}

/**
 * Review category with a working selector.
 *
 * The chevron used to be a decorative icon on a plain div — it looked like a
 * dropdown and did nothing. It is now a real button that opens a listbox,
 * closes on Escape or outside click, refuses duplicates, and returns focus.
 */
function ReviewTagSection({
  title,
  icon: Icon,
  iconClass,
  options,
  tags,
  onChange,
}: {
  title: string;
  icon: typeof AlertTriangle;
  iconClass: string;
  options: readonly string[];
  tags: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const remaining = options.filter((option) => !tags.includes(option));

  return (
    <section className="pt-2" aria-label={title}>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className={cn('size-3.5', iconClass)} aria-hidden />
        <h3 className="text-[12px] font-semibold">{title}</h3>
      </div>
      <div ref={wrapRef} className="relative">
        <div className="flex min-h-8 items-center gap-1 rounded-md border border-input bg-card px-1.5 py-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {tags.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">None</span>
            ) : (
              tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => onChange(tags.filter((t) => t !== tag))}
                    aria-label={`Remove ${tag} from ${title}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))
            )}
          </div>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? listId : undefined}
            aria-label={`Add to ${title}`}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
        </div>
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={`${title} options`}
            className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-card py-1 shadow-md"
          >
            {remaining.length === 0 ? (
              <li className="px-2 py-1.5 text-[11px] text-muted-foreground">All added</li>
            ) : (
              remaining.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      onChange([...tags, option]);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className="block w-full px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                  >
                    {option}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </section>
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
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-40 flex-1 resize-none bg-card text-[12px] leading-relaxed"
      />
    </div>
  );
}

function ExecutionList({ fills }: { fills: readonly SimulatedFill[] }) {
  if (fills.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        No executions yet. Orders placed during replay fill deterministically as candles are
        revealed.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-border/70">
      {fills.map((fill) => (
        <li key={fill.sequence} className="flex items-center gap-2 py-1.5 text-[11px]">
          <time className="tabular w-16 shrink-0 text-muted-foreground">
            {formatClock(fill.candleTime)}
          </time>
          <span
            className={cn(
              'w-8 shrink-0 font-semibold',
              fill.side === 'buy' ? 'text-profit' : 'text-loss',
            )}
          >
            {fill.side.toUpperCase()}
          </span>
          <span className="tabular w-5 shrink-0">{fill.quantity}</span>
          <span className="tabular min-w-0 flex-1 truncate font-medium">
            {formatPrice(fill.price)}
          </span>
          <span className="shrink-0 capitalize text-muted-foreground">
            {fill.role.replace('_', ' ')}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SessionOnlyNotice() {
  return (
    <p className="px-1 pb-1 pt-2 text-[10px] text-muted-foreground">Session only — not saved.</p>
  );
}

export function WorkspaceContextPanel({
  open,
  onOpenChange,
  response,
  replay,
  simulation,
  accounting,
  demoAccount: _demoAccount,
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
  accounting: AccountingSnapshot | null;
  demoAccount: DemoAccountSnapshot | null;
  playbookNote: string;
  onPlaybookNoteChange: (value: string) => void;
  contextNote: string;
  onContextNoteChange: (value: string) => void;
}) {
  const fills = simulation?.fills ?? [];
  const replayProgress = progress(replay);
  const hasFills = (accounting?.fillCount ?? 0) > 0;

  const [mistakes, setMistakes] = useState<string[]>([]);
  const [habits, setHabits] = useState<string[]>([]);
  const [setups, setSetups] = useState<string[]>([]);

  const bracket = (role: 'stop_loss' | 'take_profit'): number | null => {
    const order = simulation?.orders.find(
      (o) => o.role === role && (o.status === 'working' || o.status === 'pending'),
    );
    return order?.stopPrice ?? order?.limitPrice ?? null;
  };

  const netPnl = hasFills && accounting ? accounting.totalPnl : null;

  const sessionDay = response
    ? new Date(response.start).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : null;

  const tagSections = (
    <>
      <ReviewTagSection
        title="Mistakes"
        icon={AlertTriangle}
        iconClass="text-warning"
        options={MISTAKE_OPTIONS}
        tags={mistakes}
        onChange={setMistakes}
      />
      <ReviewTagSection
        title="Habits"
        icon={Repeat}
        iconClass="text-primary"
        options={HABIT_OPTIONS}
        tags={habits}
        onChange={setHabits}
      />
      <ReviewTagSection
        title="Setups"
        icon={Lightbulb}
        iconClass="text-profit"
        options={SETUP_OPTIONS}
        tags={setups}
        onChange={setSetups}
      />
    </>
  );

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close session context overlay"
          className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <aside
        aria-label="Session context"
        hidden={!open}
        data-state={open ? 'open' : 'closed'}
        data-responsive="desktop-panel medium-drawer small-bottom-sheet"
        className={cn(
          'z-50 flex min-h-0 w-[23rem] shrink-0 flex-col overflow-hidden border-r border-border bg-muted/60 text-foreground',
          'fixed bottom-0 left-0 top-0 lg:relative lg:z-auto lg:shadow-none',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:h-[min(76dvh,38rem)] max-sm:w-full max-sm:border-r-0 max-sm:border-t',
        )}
      >
        {/* Session identity — compact, white, one thin rule. */}
        <header className="flex min-h-[4.5rem] shrink-0 items-center gap-2 border-b border-border bg-card px-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight">
              {response?.symbol ?? 'No session'}
              {sessionDay ? (
                <span className="ml-1.5 text-[12px] font-medium text-muted-foreground">
                  {sessionDay}
                </span>
              ) : null}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {response ? response.start.slice(0, 10) : 'Load candles to begin'}
              {replay.status !== 'idle'
                ? ` · ${replayProgress.current}/${replayProgress.total}`
                : ''}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Hide session context"
          >
            <X aria-hidden />
          </Button>
        </header>

        <Tabs defaultValue="stats" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-2 pt-2">
            <TabsList className="h-9 w-full justify-between gap-0.5 rounded-lg bg-card p-1">
              {(
                [
                  ['stats', 'Stats'],
                  ['playbook', 'Playbook'],
                  ['executions', 'Executions'],
                  ['notes', 'Notes'],
                ] as const
              ).map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-7 min-w-0 flex-1 rounded-md px-1 text-[11px] text-muted-foreground shadow-none data-[state=active]:bg-primary/10 data-[state=active]:font-medium data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2 [scrollbar-width:thin]">
            <TabsContent value="stats" className="m-0">
              <div className="rounded-xl border border-border bg-card p-2.5">
                <div className="flex gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      'w-[3px] shrink-0 rounded-full',
                      netPnl === null || netPnl === 0
                        ? 'bg-border'
                        : netPnl > 0
                          ? 'bg-profit'
                          : 'bg-loss',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] text-primary/70">Net P&amp;L</p>
                    <p
                      className={cn(
                        'tabular truncate text-[22px] font-semibold leading-tight',
                        pnlTone(netPnl),
                      )}
                    >
                      {netPnl === null ? NONE : formatUsd(netPnl)}
                    </p>
                  </div>
                </div>

                <dl className="mt-2">
                  <MetricRow label="Side">
                    <span
                      className={
                        accounting?.side === 'long'
                          ? 'text-profit'
                          : accounting?.side === 'short'
                            ? 'text-loss'
                            : 'text-foreground'
                      }
                    >
                      {accounting && accounting.side !== 'flat'
                        ? accounting.side.toUpperCase()
                        : hasFills
                          ? 'FLAT'
                          : NONE}
                    </span>
                  </MetricRow>
                  <MetricRow label="Contracts traded">
                    {hasFills && accounting ? accounting.contractsTraded : NONE}
                  </MetricRow>
                  <MetricRow label="Gross P&L">
                    <span className={pnlTone(hasFills ? accounting?.realizedPnl : null)}>
                      {hasFills && accounting ? formatUsd(accounting.realizedPnl) : NONE}
                    </span>
                  </MetricRow>
                  <MetricRow label="Playbook">
                    {playbookNote.trim() ? (
                      <span className="truncate">{playbookNote.trim().split('\n')[0]}</span>
                    ) : (
                      <span className="text-muted-foreground/60">Not selected</span>
                    )}
                  </MetricRow>
                  <MetricRow label="Execution quality">
                    <QualityScale reason="A scoring model needs per-trade excursion and plan-adherence data, which is not built yet." />
                  </MetricRow>
                  <MetricRow label="MAE / MFE">
                    <ExcursionValue reason="Excursion tracking across revealed candles is not built yet." />
                  </MetricRow>
                  <MetricRow label="Trade rating">
                    <RatingControl reason="Ratings need persistent trade review storage, which is not built yet." />
                  </MetricRow>
                  <MetricRow label="Profit target" htmlFor="review-profit-target">
                    <PriceField
                      id="review-profit-target"
                      name="Profit target"
                      value={bracket('take_profit')}
                      reason={NO_MODIFY}
                    />
                  </MetricRow>
                  <MetricRow label="Stop loss" htmlFor="review-stop-loss">
                    <PriceField
                      id="review-stop-loss"
                      name="Stop loss"
                      value={bracket('stop_loss')}
                      reason={NO_MODIFY}
                    />
                  </MetricRow>
                  <MetricRow label="Initial target">
                    <LockedMetricValue reason="Needs the initial bracket captured at entry and preserved across later changes, which is not stored yet." />
                  </MetricRow>
                  <MetricRow label="Trade risk">
                    <LockedMetricValue reason="Needs an initial-risk definition from entry and initial stop, which is not stored yet." />
                  </MetricRow>
                  <MetricRow label="Planned R-multiple">
                    <LockedMetricValue reason="Depends on trade risk, which is not stored yet." />
                  </MetricRow>
                  <MetricRow label="Realized R-multiple">
                    <LockedMetricValue reason="Depends on trade risk, which is not stored yet." />
                  </MetricRow>
                </dl>

                {tagSections}
              </div>
              <SessionOnlyNotice />
            </TabsContent>

            <TabsContent value="playbook" className="m-0">
              <div className="rounded-xl border border-border bg-card p-2.5">
                <SessionNote
                  id="session-playbook"
                  label="Session playbook"
                  placeholder="Record the setup and conditions you intend to review."
                  value={playbookNote}
                  onChange={onPlaybookNoteChange}
                />
                {tagSections}
              </div>
              <SessionOnlyNotice />
            </TabsContent>

            <TabsContent value="executions" className="m-0">
              <div className="rounded-xl border border-border bg-card px-2.5 py-1">
                <ExecutionList fills={fills} />
              </div>
            </TabsContent>

            <TabsContent value="notes" className="m-0">
              <div className="rounded-xl border border-border bg-card p-2.5">
                <SessionNote
                  id="context-note"
                  label="Review notes"
                  placeholder="Capture observations from this replay."
                  value={contextNote}
                  onChange={onContextNoteChange}
                />
              </div>
              <SessionOnlyNotice />
            </TabsContent>
          </div>
        </Tabs>
      </aside>
    </>
  );
}

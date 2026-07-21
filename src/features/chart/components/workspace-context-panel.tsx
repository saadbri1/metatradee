'use client';

/**
 * Trade review panel — rebuilt to the reference composition.
 *
 * Structure: identity strip → one rounded tab group → a single white card
 * holding the P&L hero, one uninterrupted metric grid, and the review tag
 * sections. The previous version split metrics across several bordered
 * sections; the reference reads as one continuous list, so those are gone.
 *
 * HONESTY RULE (unchanged, non-negotiable): a metric without an engine keeps
 * its row and its exact visual footprint but renders a quiet disabled value —
 * never a number. Every disabled control carries an accessible reason.
 *
 * All figures arrive as props from the pure accounting fold. No financial
 * calculation happens in this file.
 */
import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Lightbulb,
  Lock,
  MoreHorizontal,
  Repeat,
  Star,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CandleResponse } from '../api';
import { progress, type ReplayState } from '@/features/replay';
import {
  formatUsd,
  formatUsdAmount,
  type AccountingSnapshot,
  type DemoAccountSnapshot,
  type SimulatedFill,
  type SimulationState,
} from '@/features/simulation';

const NONE = '—';

const NO_MODIFY =
  'Order modification is not supported yet. Cancel the bracket and place a new order to change this price.';

function formatPrice(value: number | null | undefined): string {
  return value === null || value === undefined
    ? NONE
    : value.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatTime(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(11, 19);
}

function pnlTone(value: number | null | undefined): string {
  return value === null || value === undefined || value === 0
    ? 'text-foreground'
    : value > 0
      ? 'text-profit'
      : 'text-loss';
}

/**
 * One metric line. The fixed label column puts every value on a common left
 * edge, which is what makes the grid scannable — the eye runs straight down
 * the value column instead of tracking ragged text.
 */
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
    <div className="flex min-h-[1.9rem] items-center gap-2 py-0.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="w-[8.5rem] shrink-0 text-[12px] text-primary/70">
          {label}
        </label>
      ) : (
        <dt className="w-[8.5rem] shrink-0 text-[12px] text-primary/70">{label}</dt>
      )}
      <dd className="min-w-0 flex-1 text-[12px] font-medium text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Value column for a metric whose engine does not exist yet.
 *
 * The lock glyph is deliberate: an em dash alone would be indistinguishable
 * from a real metric that simply has no data yet (Side before the first fill,
 * for instance). The reader must be able to tell "not built" from "not yet".
 */
function LockedMetricValue({ reason }: { reason: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] text-muted-foreground/60"
      title={reason}
    >
      <Lock className="size-2.5 shrink-0" aria-hidden />
      {NONE}
      <span className="sr-only">Not calculated — {reason}</span>
    </span>
  );
}

/**
 * Compact price field, read-only by design: the simulation engine can place
 * and cancel orders but not modify them, so an editable box here would be a
 * local number with no order behind it.
 */
function PriceField({ id, value, reason }: { id: string; value: number | null; reason: string }) {
  return (
    <div className="flex h-[2.1rem] w-full max-w-[10.5rem] items-center rounded-md border border-input bg-card">
      <span aria-hidden className="pl-2 pr-1 text-[11px] text-muted-foreground">
        $
      </span>
      <input
        id={id}
        type="text"
        readOnly
        disabled
        value={value === null ? NONE : String(value)}
        title={reason}
        aria-describedby={`${id}-reason`}
        className="tabular h-full w-full min-w-0 bg-transparent pr-2 text-[12px] font-medium text-foreground disabled:cursor-not-allowed"
      />
      <span id={`${id}-reason`} className="sr-only">
        {reason}
      </span>
    </div>
  );
}

/** Paired adverse / favourable excursion chips. Dashes until an engine exists. */
function ExcursionValue({
  adverse,
  favorable,
  reason,
}: {
  adverse: string;
  favorable: string;
  reason?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5" title={reason}>
      <span className="tabular rounded bg-loss/10 px-1.5 py-0.5 text-[11px] font-medium text-loss">
        {adverse}
      </span>
      <span className="text-muted-foreground/60">/</span>
      <span className="tabular rounded bg-profit/10 px-1.5 py-0.5 text-[11px] font-medium text-profit">
        {favorable}
      </span>
      {reason ? <span className="sr-only">{reason}</span> : null}
    </span>
  );
}

/** Five-star rating, disabled until persistent review state exists. */
function RatingControl({ value, reason }: { value: number | null; reason: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={reason}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(
            'size-3.5',
            value !== null && star <= value
              ? 'fill-warning text-warning'
              : 'fill-muted text-muted-foreground/30',
          )}
        />
      ))}
      <span className="sr-only">
        {value === null ? `Trade rating not available. ${reason}` : `Trade rating ${value} of 5`}
      </span>
    </span>
  );
}

/** Thin proportional scale; an empty track until a scoring model exists. */
function QualityScale({ value, reason }: { value: number | null; reason: string }) {
  return (
    <span className="flex w-full max-w-[10.5rem] items-center" title={reason}>
      <span className="relative h-1 w-full overflow-hidden rounded-full bg-loss/25">
        {value !== null ? (
          <span
            className="absolute inset-y-0 right-0 rounded-full bg-profit"
            style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          />
        ) : null}
      </span>
      <span className="sr-only">
        {value === null ? `Execution quality not available. ${reason}` : `${value} of 100`}
      </span>
    </span>
  );
}

/**
 * A review category: title row with an overflow affordance, then a bordered
 * field of removable chips. No drag handle — reordering is not implemented,
 * and an affordance that does nothing is worse than none at all.
 */
function ReviewTagSection({
  title,
  icon: Icon,
  iconClass,
  tags,
  onRemove,
}: {
  title: string;
  icon: typeof AlertTriangle;
  iconClass: string;
  tags: readonly string[];
  onRemove: (tag: string) => void;
}) {
  return (
    <section className="pt-3" aria-label={title}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className={cn('size-3.5', iconClass)} aria-hidden />
        <h3 className="text-[12px] font-semibold">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-6 text-muted-foreground"
          aria-label={`${title} options`}
          disabled
          title="Category management is not available yet."
        >
          <MoreHorizontal className="size-3.5" aria-hidden />
        </Button>
      </div>
      <div className="flex min-h-[2.25rem] items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {tags.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">None recorded</span>
          ) : (
            tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemove(tag)}
                  aria-label={`Remove ${tag} from ${title}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
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
    <div className="flex h-full min-h-0 flex-col gap-2">
      <label htmlFor={id} className="text-[12px] font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-44 flex-1 resize-none bg-card text-[12px] leading-relaxed"
      />
    </div>
  );
}

function ExecutionList({ fills }: { fills: readonly SimulatedFill[] }) {
  if (fills.length === 0) {
    return (
      <div className="px-2 py-8 text-center">
        <p className="text-[12px] font-medium">No executions in this replay session.</p>
        <p className="mx-auto mt-1 max-w-[15rem] text-[11px] leading-relaxed text-muted-foreground">
          Orders placed during replay fill deterministically as candles are revealed.
        </p>
      </div>
    );
  }
  return (
    <ol className="divide-y divide-border/70">
      {fills.map((fill) => (
        <li key={fill.sequence} className="flex items-center gap-2 py-1.5 text-[11px]">
          <time className="tabular w-[4.5rem] shrink-0 text-muted-foreground">
            {formatTime(fill.candleTime)}
          </time>
          <span
            className={cn(
              'w-8 shrink-0 font-semibold',
              fill.side === 'buy' ? 'text-profit' : 'text-loss',
            )}
          >
            {fill.side.toUpperCase()}
          </span>
          <span className="tabular w-6 shrink-0">{fill.quantity}</span>
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

/** One disclosure for the whole panel, not repeated inside every section. */
function SessionOnlyNotice() {
  return (
    <p className="px-1 pb-1 pt-3 text-[11px] text-muted-foreground">
      Session only — review notes and tags are not saved yet.
    </p>
  );
}

export function WorkspaceContextPanel({
  open,
  onOpenChange,
  response,
  replay,
  simulation,
  accounting,
  demoAccount,
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
  const workingOrders =
    simulation?.orders.filter((o) => o.status === 'pending' || o.status === 'working').length ?? 0;
  const hasFills = (accounting?.fillCount ?? 0) > 0;

  /** Browser-session review tags — no persistence layer exists for these. */
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

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close session context overlay"
          className="fixed inset-0 z-40 bg-foreground/10 lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <aside
        aria-label="Session context"
        hidden={!open}
        data-state={open ? 'open' : 'closed'}
        data-responsive="desktop-panel medium-drawer small-bottom-sheet"
        className={cn(
          // ~352px, 376px at xl: a fixed label column plus a value column that
          // holds a price field without wrapping.
          'z-50 flex min-h-0 w-[22rem] shrink-0 flex-col overflow-hidden border-r border-border bg-muted/40 xl:w-[23.5rem]',
          'fixed bottom-0 left-0 top-0 lg:relative lg:z-auto lg:shadow-none',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:h-[min(76dvh,38rem)] max-sm:w-full max-sm:border-r-0 max-sm:border-t',
        )}
      >
        <Tabs defaultValue="stats" className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 px-2 pb-1 pt-2">
            <div className="mb-2 flex items-center gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold leading-tight">
                  {response?.symbol ?? 'No session loaded'}
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
                className="ml-auto size-7 shrink-0"
                onClick={() => onOpenChange(false)}
                aria-label="Hide session context"
              >
                <X aria-hidden />
              </Button>
            </div>
            {/* One rounded group; the active tab is a pale accent fill. */}
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

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <TabsContent value="stats" className="m-0">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex gap-2.5">
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
                    <p className="text-[12px] text-primary/70">Net P&amp;L</p>
                    <p
                      className={cn(
                        'tabular mt-0.5 truncate text-[26px] font-semibold leading-none',
                        pnlTone(netPnl),
                      )}
                    >
                      {netPnl === null ? NONE : formatUsd(netPnl)}
                    </p>
                  </div>
                </div>

                <dl className="mt-4">
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
                    <QualityScale
                      value={null}
                      reason="A scoring model needs per-trade excursion and plan-adherence data, which is not built yet."
                    />
                  </MetricRow>
                  <MetricRow label="MAE / MFE">
                    <ExcursionValue
                      adverse={NONE}
                      favorable={NONE}
                      reason="Maximum adverse and favourable excursion need per-trade excursion tracking across revealed candles, which is not built yet."
                    />
                  </MetricRow>
                  <MetricRow label="Trade rating">
                    <RatingControl
                      value={null}
                      reason="Ratings need persistent trade review storage, which is not built yet."
                    />
                  </MetricRow>
                  <MetricRow label="Profit target" htmlFor="review-profit-target">
                    <PriceField
                      id="review-profit-target"
                      value={bracket('take_profit')}
                      reason={NO_MODIFY}
                    />
                  </MetricRow>
                  <MetricRow label="Stop loss" htmlFor="review-stop-loss">
                    <PriceField
                      id="review-stop-loss"
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
                  <MetricRow label="Average entry">
                    {accounting?.averageEntryPrice != null
                      ? formatPrice(accounting.averageEntryPrice)
                      : NONE}
                  </MetricRow>
                  <MetricRow label="Latest exit">
                    {accounting?.latestExitPrice != null
                      ? formatPrice(accounting.latestExitPrice)
                      : NONE}
                  </MetricRow>
                  <MetricRow label="Working orders">{workingOrders}</MetricRow>
                  <MetricRow label="Executions">{fills.length}</MetricRow>
                  {demoAccount ? (
                    <>
                      <MetricRow label="Demo balance">
                        {formatUsdAmount(demoAccount.balance)}
                      </MetricRow>
                      <MetricRow label="Demo equity">
                        <span className={pnlTone(demoAccount.totalPnl)}>
                          {formatUsdAmount(demoAccount.equity)}
                        </span>
                      </MetricRow>
                    </>
                  ) : null}
                </dl>

                <ReviewTagSection
                  title="Mistakes"
                  icon={AlertTriangle}
                  iconClass="text-warning"
                  tags={mistakes}
                  onRemove={(tag) => setMistakes((c) => c.filter((t) => t !== tag))}
                />
                <ReviewTagSection
                  title="Habits"
                  icon={Repeat}
                  iconClass="text-primary"
                  tags={habits}
                  onRemove={(tag) => setHabits((c) => c.filter((t) => t !== tag))}
                />
                <ReviewTagSection
                  title="Setups"
                  icon={Lightbulb}
                  iconClass="text-profit"
                  tags={setups}
                  onRemove={(tag) => setSetups((c) => c.filter((t) => t !== tag))}
                />
              </div>
              <SessionOnlyNotice />
            </TabsContent>

            <TabsContent value="playbook" className="m-0">
              <div className="rounded-xl border border-border bg-card p-3">
                <SessionNote
                  id="session-playbook"
                  label="Session playbook"
                  placeholder="Record the setup and conditions you intend to review."
                  value={playbookNote}
                  onChange={onPlaybookNoteChange}
                />
              </div>
              <SessionOnlyNotice />
            </TabsContent>

            <TabsContent value="executions" className="m-0">
              <div className="rounded-xl border border-border bg-card px-3 py-1">
                <ExecutionList fills={fills} />
              </div>
            </TabsContent>

            <TabsContent value="notes" className="m-0">
              <div className="rounded-xl border border-border bg-card p-3">
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

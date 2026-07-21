'use client';

/**
 * Replay transport controls.
 *
 * A labelled `role="group"` — NOT `role="toolbar"`, which implies roving
 * arrow-key navigation and would collide with ArrowLeft/ArrowRight being
 * global step shortcuts. Every control is an ordinary labelled button or
 * select in the tab order, so keyboard-only and screen-reader users have the
 * full transport without knowing a single shortcut.
 *
 * The progress line is a polite live region carrying the play state, the
 * 1-based position, and the current bar's UTC time — the textual mirror of
 * what the canvas shows. Announcements ride state changes; at `max` speed the
 * region updates faster than a screen reader narrates, which politeness
 * handles by design (queued, coalesced, never interruptive).
 */
import {
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  EyeOff,
  LocateFixed,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  REPLAY_SPEEDS,
  currentCandle,
  currentTimestamp,
  progress,
  type ReplaySpeed,
  type ReplayState,
} from '../engine';

function formatReplayTime(seconds: number | null): string {
  if (seconds === null) return '—';
  return `${new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

const STATUS_LABEL: Record<ReplayState['status'], string> = {
  idle: '',
  ready: 'Ready',
  playing: 'Playing',
  paused: 'Paused',
  completed: 'Completed',
};

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export function ReplayToolbar({
  state,
  onTogglePlay,
  onNext,
  onAdvanceTen,
  onPrevious,
  onReset,
  following,
  onResumeFollow,
  onSpeedChange,
  onExit,
}: {
  state: ReplayState;
  onTogglePlay: () => void;
  onNext: () => void;
  onAdvanceTen: () => void;
  onPrevious: () => void;
  onReset: () => void;
  following: boolean;
  onResumeFollow: () => void;
  onSpeedChange: (speed: ReplaySpeed) => void;
  onExit: () => void;
}) {
  if (state.status === 'idle') return null;

  const { current, total } = progress(state);
  const playing = state.status === 'playing';
  const completed = state.status === 'completed';
  const atStart = state.cursor <= state.startCursor;
  const candle = currentCandle(state);
  const percent = total === 0 ? 0 : Math.round((current / total) * 100);
  /*
   * Status is carried by the WORD first and colour second — the label is always
   * present, so the four states stay distinguishable without relying on hue.
   */
  const statusClass =
    state.status === 'playing'
      ? 'border-primary/40 bg-primary/10 text-primary'
      : state.status === 'completed'
        ? 'border-border bg-muted text-foreground'
        : 'border-border bg-muted/60 text-muted-foreground';

  return (
    <section
      aria-label="Replay transport"
      data-state={state.status}
      /* Second row of the shared replay terminal; the container owns the frame. */
      className="relative border-t border-border/60 bg-transparent"
    >
      <div
        role="group"
        aria-label="Replay controls"
        className="flex min-h-10 items-center gap-0.5 overflow-x-auto px-2 py-0.5"
      >
        <span
          className={`mr-1 inline-flex min-w-[4.5rem] items-center justify-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${statusClass}`}
        >
          {STATUS_LABEL[state.status]}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onReset}
          title="Reset replay (R)"
        >
          <RotateCcw className="size-4" aria-hidden />
          <span className="sr-only">Reset replay</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onPrevious}
          disabled={atStart}
          title="Previous candle (←)"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="sr-only">Previous candle</span>
        </Button>

        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-8 min-w-10 px-3"
          onClick={onTogglePlay}
          disabled={completed}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
        >
          {playing ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
          <span className="sr-only">{playing ? 'Pause replay' : 'Play replay'}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onNext}
          disabled={completed}
          title="Next candle (→)"
        >
          <ChevronRight className="size-4" aria-hidden />
          <span className="sr-only">Next candle</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onAdvanceTen}
          disabled={completed}
          title="Advance ten candles (Shift+→)"
        >
          <ChevronsRight className="size-4" aria-hidden />
          <span className="sr-only">Advance ten candles</span>
        </Button>

        <label className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="sr-only sm:not-sr-only">Speed</span>
          <select
            aria-label="Replay speed"
            className={selectClass}
            value={state.speed}
            onChange={(e) => onSpeedChange(e.target.value as ReplaySpeed)}
          >
            {REPLAY_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <Button
          type="button"
          variant={following ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2"
          onClick={onResumeFollow}
          disabled={following}
          aria-label={following ? 'Replay cursor follow enabled' : 'Resume replay cursor follow'}
          aria-pressed={following}
        >
          <LocateFixed className="size-3.5" aria-hidden />
          <span className="hidden lg:inline">{following ? 'Following' : 'Resume follow'}</span>
        </Button>

        {/* Textual mirror of the replay position — announced politely. */}
        <p
          role="status"
          aria-live="polite"
          className="tabular ml-2 hidden min-w-0 text-[11px] text-muted-foreground md:block"
        >
          {STATUS_LABEL[state.status]} · Candle {current} of {total} ·{' '}
          <strong className="font-medium text-foreground">
            {formatReplayTime(currentTimestamp(state))}
          </strong>
          {candle ? (
            <span className="sr-only">
              {' '}
              Open {candle.open}. High {candle.high}. Low {candle.low}. Close {candle.close}. Volume{' '}
              {candle.volume}.
            </span>
          ) : null}
        </p>

        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          <EyeOff className="size-3" aria-hidden />
          Future hidden
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onExit}
          title="Exit replay (Esc)"
        >
          <X className="size-4" aria-hidden />
          <span className="sr-only">Exit replay</span>
        </Button>
      </div>
      <div
        role="progressbar"
        aria-label="Replay progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={`${current} of ${total} candles revealed`}
        className="h-1 bg-muted"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}

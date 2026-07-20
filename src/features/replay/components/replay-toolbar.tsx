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
  onSpeedChange,
  onExit,
}: {
  state: ReplayState;
  onTogglePlay: () => void;
  onNext: () => void;
  onAdvanceTen: () => void;
  onPrevious: () => void;
  onReset: () => void;
  onSpeedChange: (speed: ReplaySpeed) => void;
  onExit: () => void;
}) {
  if (state.status === 'idle') return null;

  const { current, total } = progress(state);
  const playing = state.status === 'playing';
  const completed = state.status === 'completed';
  const atStart = state.cursor <= 0;
  const candle = currentCandle(state);
  const percent = total === 0 ? 0 : Math.round((current / total) * 100);
  const statusClass =
    state.status === 'playing'
      ? 'border-primary/30 bg-primary/10 text-primary'
      : state.status === 'completed'
        ? 'border-foreground/25 bg-foreground/10 text-foreground'
        : 'border-warning/30 bg-warning/10 text-warning';

  return (
    <section
      aria-label="Replay transport"
      data-state={state.status}
      className="relative border-x border-b border-primary/30 bg-card/95 shadow-[0_-8px_24px_hsl(var(--background)/0.16)]"
    >
      <div
        role="group"
        aria-label="Replay controls"
        className="flex min-h-12 flex-wrap items-center gap-1 px-2 py-1.5"
      >
        <span
          className={`mr-1 inline-flex min-w-20 items-center justify-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClass}`}
        >
          {STATUS_LABEL[state.status]}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-none px-2"
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
          className="h-8 rounded-none px-2"
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
          className="h-8 min-w-10 rounded-none px-3"
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
          className="h-8 rounded-none px-2"
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
          className="h-8 rounded-none px-2"
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

        {/* Textual mirror of the replay position — announced politely. */}
        <p
          role="status"
          aria-live="polite"
          className="tabular ml-2 min-w-0 text-[11px] text-muted-foreground"
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

        <span className="ml-auto inline-flex items-center gap-1 border border-warning/25 bg-warning/5 px-1.5 py-1 text-[10px] text-warning">
          <EyeOff className="size-3" aria-hidden />
          Future hidden
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-none px-2"
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

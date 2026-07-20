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
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react';
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
  onPrevious,
  onReset,
  onSpeedChange,
  onExit,
}: {
  state: ReplayState;
  onTogglePlay: () => void;
  onNext: () => void;
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

  return (
    <div
      role="group"
      aria-label="Replay controls"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
    >
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
        variant="outline"
        size="sm"
        className="h-8 px-3"
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

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
      <p role="status" aria-live="polite" className="tabular ml-1 text-xs text-muted-foreground">
        {STATUS_LABEL[state.status]} · Candle {current} of {total} ·{' '}
        <span className="text-foreground">{formatReplayTime(currentTimestamp(state))}</span>
        {candle ? (
          <span className="sr-only">
            {' '}
            Open {candle.open}. High {candle.high}. Low {candle.low}. Close {candle.close}. Volume{' '}
            {candle.volume}.
          </span>
        ) : null}
      </p>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto h-8 px-2"
        onClick={onExit}
        title="Exit replay (Esc)"
      >
        <X className="size-4" aria-hidden />
        <span className="sr-only">Exit replay</span>
      </Button>
    </div>
  );
}

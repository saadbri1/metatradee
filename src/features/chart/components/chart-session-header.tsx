'use client';

import {
  Focus,
  Maximize2,
  Menu,
  Minimize2,
  MoreHorizontal,
  PanelLeftOpen,
  Play,
  RotateCcw,
  ShoppingCart,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { CandleResponse } from '../api';

function compactDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

/**
 * The loaded session's calendar day, e.g. "Mon, 6 Jun 2022". Derived from the
 * response's own start timestamp — never "today", which would imply the
 * workspace is showing live data. UTC to match every other time on this route.
 */
function sessionDay(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function ChartSessionHeader({
  response,
  replayActive,
  canReplay,
  replayTime,
  contextPanelOpen,
  orderPanelOpen,
  expanded,
  onOpenNavigation,
  onToggleContextPanel,
  onStartReplay,
  onExitReplay,
  onToggleOrderPanel,
  onFit,
  onReset,
  onToggleExpanded,
}: {
  response: CandleResponse | null;
  replayActive: boolean;
  canReplay: boolean;
  replayTime: string | null;
  contextPanelOpen: boolean;
  orderPanelOpen: boolean;
  expanded: boolean;
  onOpenNavigation: () => void;
  onToggleContextPanel: () => void;
  onStartReplay: () => void;
  onExitReplay: () => void;
  onToggleOrderPanel: () => void;
  onFit: () => void;
  onReset: () => void;
  onToggleExpanded: () => void;
}) {
  const range = response
    ? `${compactDate(response.start)} – ${compactDate(response.end)}`
    : 'No historical session loaded';
  const day = response ? sessionDay(response.start) : null;

  return (
    <header
      aria-label="Chart session header"
      /*
       * ~52px: tall enough for a two-line identity block (contract + session
       * date), short enough that the chart keeps the viewport. Solid surface
       * rather than translucent-with-blur; a single hairline border separates
       * the compact terminal header cleanly from the market toolbar.
       */
      className="relative z-30 flex min-h-[3.25rem] shrink-0 items-center gap-2 border-b border-border bg-card px-3"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 shrink-0 rounded-md"
        onClick={onOpenNavigation}
        aria-label="Open navigation"
      >
        <Menu aria-hidden />
      </Button>
      <div className="hidden shrink-0 items-center gap-2 border-r border-border pr-3 md:flex">
        <span className="font-display text-xs font-semibold tracking-tight">MetaTradee</span>
        <span className="border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
          Replay terminal
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('size-8 shrink-0', contextPanelOpen && 'bg-primary/10 text-primary')}
        onClick={onToggleContextPanel}
        aria-label={contextPanelOpen ? 'Hide session context' : 'Show session context'}
        aria-pressed={contextPanelOpen}
      >
        <PanelLeftOpen aria-hidden />
      </Button>

      <div className="min-w-0 border-l border-border pl-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="truncate font-display text-sm font-semibold tracking-tight">
            {response?.symbol ?? 'Chart workspace'}
          </h1>
          <span className="shrink-0 text-[11px] font-medium text-primary">
            {response?.timeframe ?? '—'}
          </span>
          {replayActive ? (
            <span className="hidden shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-primary sm:inline-flex">
              <span aria-hidden className="size-1.5 rounded-full bg-primary" />
              Replay mode
            </span>
          ) : null}
        </div>
        {/*
          Secondary line: the session's calendar day plus the precise range or
          replay cursor. The day is the human anchor; the range stays available
          because a dated contract session is defined by its exact UTC window.
        */}
        <p className="tabular truncate text-[10px] text-muted-foreground">
          {day ? <span className="font-medium text-foreground/70">{day}</span> : null}
          {day ? ' · ' : ''}
          {replayTime ? `Cursor ${replayTime}` : range}
        </p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {replayActive ? (
          <Button type="button" size="sm" className="h-8 gap-1.5 px-2.5" onClick={onExitReplay}>
            <X aria-hidden />
            <span className="hidden sm:inline">Exit replay</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 px-2.5"
            disabled={!canReplay}
            onClick={onStartReplay}
            aria-label="Start replay"
          >
            <Play aria-hidden />
            <span className="hidden sm:inline">Replay</span>
          </Button>
        )}
        <Button
          type="button"
          variant={orderPanelOpen ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          disabled={!replayActive}
          onClick={onToggleOrderPanel}
          aria-label={orderPanelOpen ? 'Close order panel' : 'Open order panel'}
          aria-pressed={orderPanelOpen}
        >
          <ShoppingCart aria-hidden />
          <span className="hidden sm:inline">Order</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden size-8 sm:inline-flex"
          onClick={onToggleExpanded}
          aria-label={expanded ? 'Exit expanded workspace' : 'Expand workspace'}
          aria-pressed={expanded}
        >
          {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="More chart actions"
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onFit}>
              <Focus aria-hidden />
              Fit candles to view
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onReset}>
              <RotateCcw aria-hidden />
              Reset chart view
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onToggleContextPanel}>
              <PanelLeftOpen aria-hidden />
              {contextPanelOpen ? 'Hide session context' : 'Show session context'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

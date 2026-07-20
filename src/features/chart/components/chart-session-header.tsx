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

  return (
    <header
      aria-label="Chart session header"
      className="relative z-30 flex min-h-12 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-2 shadow-sm backdrop-blur"
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
        <p className="tabular truncate text-[10px] text-muted-foreground">
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

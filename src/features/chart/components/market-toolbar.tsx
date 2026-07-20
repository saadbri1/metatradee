'use client';

import type { ReactNode } from 'react';
import {
  CandlestickChart,
  CircleDashed,
  Database,
  Eye,
  EyeOff,
  Focus,
  Lock,
  Maximize2,
  Minimize2,
  PanelRight,
  Play,
  Settings2,
  Unlock,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function MarketToolbar({
  symbol,
  timeframe,
  range,
  candleCount,
  provider,
  dataStatus,
  replayTime,
  replayActive,
  canReplay,
  dirty,
  marketOpen,
  onMarketOpenChange,
  marketControls,
  onFit,
  scaleLocked,
  onToggleScaleLock,
  volumeVisible,
  onToggleVolume,
  annotationsVisible,
  onToggleAnnotations,
  onStartReplay,
  onExitReplay,
  onOpenOrderPanel,
  expanded,
  onToggleExpanded,
}: {
  symbol: string | null;
  timeframe: string | null;
  range: string | null;
  candleCount: number | null;
  provider: string | null;
  dataStatus: string;
  replayTime: string | null;
  replayActive: boolean;
  canReplay: boolean;
  dirty: boolean;
  marketOpen: boolean;
  onMarketOpenChange: (open: boolean) => void;
  marketControls: ReactNode;
  onFit: () => void;
  scaleLocked: boolean;
  onToggleScaleLock: () => void;
  volumeVisible: boolean;
  onToggleVolume: () => void;
  annotationsVisible: boolean;
  onToggleAnnotations: () => void;
  onStartReplay: () => void;
  onExitReplay: () => void;
  onOpenOrderPanel: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <section
      aria-label="Market toolbar"
      data-replay-active={replayActive}
      className="relative z-20 flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-card/95 px-2 py-1.5 shadow-sm backdrop-blur-sm"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center border border-primary/25 bg-primary/10">
          <CandlestickChart className="size-4 text-primary" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate font-display text-sm font-semibold">
              {symbol ?? 'No series loaded'}
            </h1>
            <span className="text-xs text-muted-foreground">{timeframe ?? '—'}</span>
          </div>
          <p className="tabular max-w-[34rem] truncate text-[10px] text-muted-foreground">
            {replayTime
              ? `Replay ${replayTime}`
              : (range ?? 'Choose a dated contract and UTC range')}
          </p>
        </div>
      </div>

      {replayActive ? (
        <span className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-primary" />
          Replay mode
        </span>
      ) : null}

      <div className="hidden items-center gap-3 border-l border-border pl-3 text-[10px] text-muted-foreground lg:flex">
        <span>{candleCount === null ? '— candles' : `${candleCount} candles`}</span>
        {provider ? (
          <span className="inline-flex items-center gap-1">
            <Database className="size-3" aria-hidden />
            Real historical market data · {provider === 'databento' ? 'Databento' : provider}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${provider ? 'bg-primary' : 'bg-muted-foreground'}`}
          />
          {dataStatus}
        </span>
      </div>

      {dirty ? (
        <span role="status" className="inline-flex items-center gap-1 text-[10px] text-warning">
          <CircleDashed className="size-3" aria-hidden />
          Changes not loaded
        </span>
      ) : null}

      <div className="ml-auto flex items-center gap-0.5">
        <Popover open={marketOpen} onOpenChange={onMarketOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" aria-label="Change market">
              <Settings2 aria-hidden />
              <span className="hidden md:inline">Change market</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(52rem,calc(100vw-1rem))] p-3">
            <div className="mb-3">
              <h2 className="text-sm font-medium">Change market</h2>
              <p className="text-xs text-muted-foreground">
                Draft values never fetch until Load candles is selected.
              </p>
            </div>
            {marketControls}
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onFit}
          aria-label="Fit candles to view"
        >
          <Focus aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 sm:inline-flex"
          onClick={onToggleScaleLock}
          aria-label={scaleLocked ? 'Unlock price scale' : 'Lock price scale'}
          aria-pressed={scaleLocked}
        >
          {scaleLocked ? <Lock aria-hidden /> : <Unlock aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 md:inline-flex"
          onClick={onToggleVolume}
          aria-label={volumeVisible ? 'Hide volume' : 'Show volume'}
          aria-pressed={volumeVisible}
        >
          {volumeVisible ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 md:inline-flex"
          onClick={onToggleAnnotations}
          aria-label={annotationsVisible ? 'Hide order annotations' : 'Show order annotations'}
          aria-pressed={annotationsVisible}
        >
          {annotationsVisible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
        </Button>
        {replayActive ? (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onExitReplay}>
            <X aria-hidden />
            <span className="hidden sm:inline">Exit replay</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={!canReplay}
            onClick={onStartReplay}
          >
            <Play aria-hidden />
            <span className="hidden sm:inline">Start replay</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 xl:hidden"
          onClick={onOpenOrderPanel}
          aria-label="Open order panel"
        >
          <PanelRight aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 sm:inline-flex"
          onClick={onToggleExpanded}
          aria-label={expanded ? 'Exit expanded workspace' : 'Expand workspace'}
          aria-pressed={expanded}
        >
          {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </Button>
      </div>
    </section>
  );
}

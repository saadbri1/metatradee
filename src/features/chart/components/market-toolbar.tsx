'use client';

import type { ReactNode } from 'react';
import {
  CircleDashed,
  Eye,
  EyeOff,
  Focus,
  Lock,
  Settings2,
  Unlock,
  Volume2,
  VolumeX,
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
}: {
  symbol: string | null;
  timeframe: string | null;
  range: string | null;
  candleCount: number | null;
  provider: string | null;
  dataStatus: string;
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
}) {
  return (
    <section
      aria-label="Market toolbar"
      className="relative z-20 flex min-h-10 shrink-0 items-center gap-1 border-b border-border bg-card px-2"
    >
      <div className="flex min-w-0 items-center gap-2 border-r border-border pr-2">
        <span className="truncate text-xs font-semibold">{symbol ?? 'No market'}</span>
        <span className="border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {timeframe ?? '—'}
        </span>
      </div>

      <div className="hidden min-w-0 items-center gap-3 text-[10px] text-muted-foreground lg:flex">
        <span>{candleCount === null ? '— candles' : `${candleCount} candles`}</span>
        {provider ? (
          <span>
            Real historical market data · {provider === 'databento' ? 'Databento' : provider}
          </span>
        ) : null}
        <span>{dataStatus}</span>
        {range ? <span className="hidden max-w-72 truncate 2xl:inline">{range}</span> : null}
      </div>

      <Popover open={marketOpen} onOpenChange={onMarketOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2" aria-label="Change market">
            <Settings2 aria-hidden />
            <span className="hidden md:inline">Change market</span>
          </Button>
        </PopoverTrigger>
        {/* Portal content escapes the workspace subtree; it inherits the
            route-scoped light tokens from the app shell instead. */}
        <PopoverContent align="start" className="w-[min(52rem,calc(100vw-1rem))] p-3">
          <div className="mb-3">
            <h2 className="text-sm font-medium">Change market</h2>
            <p className="text-xs text-muted-foreground">
              Draft values never fetch until Load candles is selected.
            </p>
          </div>
          {marketControls}
        </PopoverContent>
      </Popover>

      {dirty ? (
        <span role="status" className="inline-flex items-center gap-1 text-[10px] text-warning">
          <CircleDashed className="size-3" aria-hidden />
          Changes not loaded
        </span>
      ) : null}

      <div className="ml-auto flex items-center gap-0.5">
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
          className="size-8"
          onClick={onToggleScaleLock}
          aria-label={scaleLocked ? 'Unlock price scale' : 'Lock price scale'}
          aria-pressed={scaleLocked}
        >
          {scaleLocked ? <Lock aria-hidden /> : <Unlock aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 sm:inline-flex"
          onClick={onToggleVolume}
          aria-label={volumeVisible ? 'Hide volume' : 'Show volume'}
          aria-pressed={volumeVisible}
        >
          {volumeVisible ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 sm:inline-flex"
          onClick={onToggleAnnotations}
          aria-label={annotationsVisible ? 'Hide order annotations' : 'Show order annotations'}
          aria-pressed={annotationsVisible}
        >
          {annotationsVisible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
        </Button>
      </div>
    </section>
  );
}

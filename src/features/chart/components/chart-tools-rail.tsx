'use client';

import type { ReactNode } from 'react';
import {
  Crosshair,
  Eye,
  EyeOff,
  Focus,
  Keyboard,
  Lock,
  Maximize2,
  RotateCcw,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ChartCrosshairMode } from '../provider';

function Key({ value }: { value: string }) {
  return <kbd className="rounded border border-border px-1.5 font-mono text-[10px]">{value}</kbd>;
}

const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['Lock scale / fit / market', 'L · F · /'],
  ['Play / previous / next', 'Space · ← · →'],
  ['Advance ten / reset', 'Shift+→ · R'],
  ['Buy / sell / order panel', 'B · S · O'],
  ['Workspace tabs', '1 · 2 · 3 · 4'],
  ['Close nearest surface', 'Esc'],
];

function ToolButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`size-9 rounded-none border-y border-transparent ${
        pressed ? 'border-primary/20 bg-primary/10 text-primary' : 'text-muted-foreground'
      }`}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ChartToolsRail({
  crosshairMode,
  onCrosshairModeChange,
  onFit,
  onReset,
  scaleLocked,
  onToggleScaleLock,
  volumeVisible,
  onToggleVolume,
  annotationsVisible,
  onToggleAnnotations,
  workspaceExpanded,
  onToggleWorkspaceExpanded,
}: {
  crosshairMode: ChartCrosshairMode;
  onCrosshairModeChange: (mode: ChartCrosshairMode) => void;
  onFit: () => void;
  onReset: () => void;
  scaleLocked: boolean;
  onToggleScaleLock: () => void;
  volumeVisible: boolean;
  onToggleVolume: () => void;
  annotationsVisible: boolean;
  onToggleAnnotations: () => void;
  workspaceExpanded: boolean;
  onToggleWorkspaceExpanded: () => void;
}) {
  return (
    <aside
      aria-label="Working chart tools"
      className="row-span-2 row-start-1 hidden min-h-0 flex-col items-center border-r border-border bg-card/95 py-1 sm:col-start-1 sm:flex"
    >
      <ToolButton
        label={crosshairMode === 'free' ? 'Use magnet crosshair' : 'Use free crosshair'}
        pressed={crosshairMode === 'magnet'}
        onClick={() => onCrosshairModeChange(crosshairMode === 'free' ? 'magnet' : 'free')}
      >
        <Crosshair aria-hidden />
      </ToolButton>
      <ToolButton label="Fit candles to view" onClick={onFit}>
        <Focus aria-hidden />
      </ToolButton>
      <ToolButton label="Reset chart view" onClick={onReset}>
        <RotateCcw aria-hidden />
      </ToolButton>
      <span aria-hidden className="my-1 h-px w-6 bg-border" />
      <ToolButton
        label={scaleLocked ? 'Unlock price scale' : 'Lock price scale'}
        pressed={scaleLocked}
        onClick={onToggleScaleLock}
      >
        {scaleLocked ? <Lock aria-hidden /> : <Unlock aria-hidden />}
      </ToolButton>
      <ToolButton
        label={volumeVisible ? 'Hide volume' : 'Show volume'}
        pressed={volumeVisible}
        onClick={onToggleVolume}
      >
        {volumeVisible ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
      </ToolButton>
      <ToolButton
        label={annotationsVisible ? 'Hide order annotations' : 'Show order annotations'}
        pressed={annotationsVisible}
        onClick={onToggleAnnotations}
      >
        {annotationsVisible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
      </ToolButton>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-auto size-9 rounded-none"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
          >
            <Keyboard aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" align="end" className="w-80 text-sm">
          <h2 className="font-medium">Keyboard shortcuts</h2>
          <dl className="mt-3 space-y-1.5 text-muted-foreground">
            {SHORTCUTS.map(([label, key]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <dt>{label}</dt>
                <dd>
                  <Key value={key} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
            Shortcuts pause while you are typing. Every action also has a labelled control.
          </p>
        </PopoverContent>
      </Popover>
      <ToolButton
        label={workspaceExpanded ? 'Exit expanded workspace' : 'Expand workspace'}
        pressed={workspaceExpanded}
        onClick={onToggleWorkspaceExpanded}
      >
        {workspaceExpanded ? (
          <Maximize2 className="rotate-180" aria-hidden />
        ) : (
          <Maximize2 aria-hidden />
        )}
      </ToolButton>
    </aside>
  );
}

'use client';

import { BookOpen, CandlestickChart, Gauge, Layers3 } from 'lucide-react';
import type { CandleResponse } from '../api';
import type { Candle, CandleSummary } from '../types';
import { progress, type ReplayState } from '@/features/replay';
import type { SimulationState } from '@/features/simulation';

function number(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined
    ? '—'
    : value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/60 py-2 last:border-b-0">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 truncate text-xs font-medium text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

export function WorkspaceContextPanel({
  response,
  candles,
  summary,
  replay,
  simulation,
}: {
  response: CandleResponse | null;
  candles: readonly Candle[];
  summary: CandleSummary;
  replay: ReplayState;
  simulation: SimulationState | null;
}) {
  const current = candles.at(-1) ?? null;
  const replayProgress = progress(replay);
  const hidden = response ? Math.max(0, response.candles.length - candles.length) : 0;
  const workingOrders =
    simulation?.orders.filter((order) => order.status === 'pending' || order.status === 'working')
      .length ?? 0;

  return (
    <aside
      aria-label="Replay context"
      className="hidden min-h-0 flex-col border-r border-border bg-card/70 2xl:col-start-2 2xl:row-span-2 2xl:row-start-1 2xl:flex"
    >
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Gauge className="size-3.5 text-primary" aria-hidden />
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em]">Replay desk</h2>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Real loaded data · Session controls
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section aria-labelledby="market-context-heading" className="border-b border-border p-3">
          <h3
            id="market-context-heading"
            className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            <CandlestickChart className="size-3" aria-hidden />
            Market
          </h3>
          <dl className="mt-1">
            <Stat label="Current close" value={number(current?.close)} />
            <Stat label="Visible high" value={number(summary.high)} />
            <Stat label="Visible low" value={number(summary.low)} />
            <Stat label="Visible candles" value={String(summary.count)} />
            <Stat label="Volume" value={number(summary.totalVolume, 0)} />
          </dl>
        </section>

        <section aria-labelledby="replay-context-heading" className="border-b border-border p-3">
          <h3
            id="replay-context-heading"
            className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            <Layers3 className="size-3" aria-hidden />
            Session
          </h3>
          <dl className="mt-1">
            <Stat
              label="Replay state"
              value={replay.status === 'idle' ? 'Not active' : replay.status}
            />
            <Stat
              label="Progress"
              value={
                replay.status === 'idle'
                  ? '—'
                  : `${replayProgress.current} / ${replayProgress.total}`
              }
            />
            <Stat label="Future candles hidden" value={String(hidden)} />
            <Stat label="Working orders" value={String(workingOrders)} />
            <Stat label="Executions" value={String(simulation?.fills.length ?? 0)} />
          </dl>
        </section>

        <section aria-labelledby="playbook-context-heading" className="p-3">
          <h3
            id="playbook-context-heading"
            className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            <BookOpen className="size-3" aria-hidden />
            Playbook
          </h3>
          <div className="mt-2 border border-border bg-background/40 p-2.5">
            <p className="text-xs font-medium">No playbook linked</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Use the Journal tab for session-only review notes. Linking saved playbooks remains a
              separate product capability.
            </p>
          </div>
        </section>
      </div>
    </aside>
  );
}

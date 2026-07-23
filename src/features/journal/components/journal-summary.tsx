'use client';

import type { CSSProperties } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { JournalSummary } from '../types';

function money(value: number | null, currency: string): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}
function ratio(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(2)}%`;
}

function ProfitFactorGauge({ value }: { value: number | null }) {
  const LENGTH = 138.2;
  const fraction = value === null ? null : Math.max(0, Math.min(1, value / (value + 1)));
  return (
    <svg viewBox="0 0 100 56" className="h-[42px] w-[74px] shrink-0 overflow-visible" aria-hidden>
      <path
        d="M6,50 A44,44 0 0 1 94,50"
        fill="none"
        stroke="hsl(var(--loss))"
        strokeWidth="9"
        strokeLinecap="round"
        opacity={value === null ? 0.18 : 0.85}
      />
      {fraction !== null ? (
        <path
          d="M6,50 A44,44 0 0 1 94,50"
          fill="none"
          stroke="hsl(var(--profit))"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${fraction * LENGTH} ${LENGTH}`}
        />
      ) : null}
    </svg>
  );
}

function WinRateDonut({
  wins,
  losses,
  breakEven,
}: {
  wins: number;
  losses: number;
  breakEven: number;
}) {
  const total = wins + losses + breakEven;
  const winStop = total > 0 ? (wins / total) * 100 : 0;
  const lossStop = total > 0 ? winStop + (losses / total) * 100 : 0;
  const style = {
    '--journal-donut':
      total > 0
        ? `conic-gradient(hsl(var(--profit)) 0 ${winStop}%, hsl(var(--loss)) ${winStop}% ${lossStop}%, hsl(var(--muted)) ${lossStop}% 100%)`
        : 'conic-gradient(hsl(var(--muted)) 0 100%)',
  } as CSSProperties;
  return (
    <div
      className="grid size-[48px] shrink-0 place-items-center rounded-full bg-[image:var(--journal-donut)] p-[6px]"
      style={style}
      aria-hidden
    >
      <span className="size-full rounded-full bg-card" />
    </div>
  );
}

function WinLossBar({
  avgWin,
  avgLoss,
  currency,
}: {
  avgWin: number | null;
  avgLoss: number | null;
  currency: string;
}) {
  const win = avgWin ?? 0;
  const loss = Math.abs(avgLoss ?? 0);
  const total = win + loss;
  const winPercent = total > 0 ? (win / total) * 100 : 50;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {total > 0 ? (
          <>
            <span className="bg-profit" style={{ width: `${winPercent}%` }} />
            <span className="bg-loss" style={{ width: `${100 - winPercent}%` }} />
          </>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] tabular-nums">
        <span className="truncate text-profit">
          {avgWin === null ? '—' : money(avgWin, currency)}
        </span>
        <span className="truncate text-loss">
          {avgLoss === null ? '—' : money(avgLoss, currency)}
        </span>
      </div>
    </div>
  );
}

function Card({
  label,
  hint,
  value,
  tone,
  visual,
  srLabel,
}: {
  label: string;
  hint: string;
  value: string;
  tone?: 'profit' | 'loss' | null;
  visual: React.ReactNode;
  srLabel: string;
}) {
  return (
    <article
      className="flex min-h-[92px] items-center gap-3 rounded-md border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]"
      aria-label={srLabel}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{label}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-full text-muted-foreground/70 hover:text-foreground"
                aria-label={`About ${label}`}
              >
                <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                  <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <path
                    d="M8 7v4M8 5h.01"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{hint}</TooltipContent>
          </Tooltip>
        </div>
        <p
          className={cn(
            'mt-1 text-[22px] font-semibold tabular-nums tracking-tight',
            tone === 'profit' && 'text-profit',
            tone === 'loss' && 'text-loss',
          )}
        >
          {value}
        </p>
      </div>
      {visual}
    </article>
  );
}

/** The four compact Journal KPI cards, computed server-side over the filtered set. */
export function JournalSummaryRow({
  summary,
  isLoading,
}: {
  summary: JournalSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !summary) {
    return (
      <section
        aria-label="Journal summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        data-journal-summary="loading"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-md border border-border/70 bg-muted/40"
          />
        ))}
      </section>
    );
  }

  const { currency } = summary;
  const hasTrades = summary.totalTrades > 0;

  return (
    <TooltipProvider delayDuration={120}>
      <section
        aria-label="Journal summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        data-journal-summary="ready"
      >
        <Card
          label="Net P&L"
          hint="Realized net P&L across all closed trades matching the current filters."
          value={hasTrades ? money(summary.netProfit, currency) : '—'}
          tone={
            hasTrades
              ? summary.netProfit > 0
                ? 'profit'
                : summary.netProfit < 0
                  ? 'loss'
                  : null
              : null
          }
          srLabel={`Net P&L ${hasTrades ? money(summary.netProfit, currency) : 'unavailable'} across ${summary.totalTrades} trades`}
          visual={
            <span className="text-right text-[11px] text-muted-foreground">
              {hasTrades ? (
                <>
                  {summary.totalTrades}
                  <br />
                  trades
                </>
              ) : null}
            </span>
          }
        />
        <Card
          label="Profit Factor"
          hint="Gross profit divided by absolute gross loss. Unavailable when there are no losing trades."
          value={ratio(summary.profitFactor)}
          srLabel={`Profit factor ${ratio(summary.profitFactor)}`}
          visual={<ProfitFactorGauge value={summary.profitFactor} />}
        />
        <Card
          label="Win Rate"
          hint="Winning trades divided by decided trades. Break-even trades stay in the denominator."
          value={percent(summary.winRate)}
          srLabel={`Win rate ${percent(summary.winRate)}, ${summary.wins} winners, ${summary.losses} losers`}
          visual={
            <div className="flex items-center gap-2">
              <span className="text-right text-[11px] tabular-nums">
                <span className="text-profit">{summary.wins}</span>
                <br />
                <span className="text-loss">{summary.losses}</span>
              </span>
              <WinRateDonut
                wins={summary.wins}
                losses={summary.losses}
                breakEven={summary.breakEven}
              />
            </div>
          }
        />
        <Card
          label="Avg win/loss trade"
          hint="Average winning trade over the magnitude of the average losing trade, with both real averages shown."
          value={
            summary.avgWin !== null && summary.avgLoss !== null && summary.avgLoss !== 0
              ? ratio(summary.avgWin / Math.abs(summary.avgLoss))
              : '—'
          }
          srLabel="Average win to loss ratio"
          visual={
            <WinLossBar avgWin={summary.avgWin} avgLoss={summary.avgLoss} currency={currency} />
          }
        />
      </section>
    </TooltipProvider>
  );
}

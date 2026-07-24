'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FormAlert } from '@/features/auth/components/form-alert';
import {
  parseTradeQuery,
  serializeTradeQuery,
  type TradeFilters,
} from '@/features/journal/filters';
import { useAnalyticsWorkspace } from '../hooks';
import { buildInsights } from '../insights';
import { DATE_PRESETS, inferPreset, presetRange, type DatePreset } from '../date-presets';
import { money, percent, ratio, integer, duration } from '../format';
import type { AnalyticsWorkspaceData, BreakdownRow } from '../types';
import { EquityChart } from './equity-chart';
import {
  BreakdownBars,
  BreakdownKpiTable,
  LockedStat,
  SectionCard,
  Stat,
} from './analytics-primitives';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'performance', label: 'Performance' },
  { value: 'risk', label: 'Risk' },
  { value: 'symbols', label: 'Setups & Symbols' },
  { value: 'time', label: 'Time' },
  { value: 'behavior', label: 'Behavior' },
] as const;
type TabValue = (typeof TABS)[number]['value'];

const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function useFilterState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters, sort } = useMemo(
    () => parseTradeQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  function apply(next: Partial<TradeFilters>) {
    const qs = serializeTradeQuery({ ...filters, ...next }, sort);
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
  }
  function reset() {
    router.replace(pathname);
  }
  return { filters, apply, reset };
}

export function AnalyticsWorkspace() {
  const { filters, apply, reset } = useFilterState();
  const [tab, setTab] = useState<TabValue>('overview');
  const query = useAnalyticsWorkspace(filters);
  const data = query.data;

  const activeFilterCount = Object.keys(filters).length;
  const preset = inferPreset(filters);

  function setPreset(value: DatePreset) {
    if (value === 'all' || value === 'custom') {
      apply({ date_from: undefined, date_to: undefined });
      return;
    }
    const r = presetRange(value);
    apply({ date_from: r.from, date_to: r.to });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3">
        {/* Header + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">Analytics</h1>
            {data?.summary && data.summary.kpis.totalTrades > 0 ? (
              <p className="text-xs text-muted-foreground">
                {integer(data.summary.kpis.totalTrades)} closed-eligible trades
                {activeFilterCount > 0
                  ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`
                  : ''}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterCount > 0 ? (
              <Button variant="ghost" size="sm" className="h-9" onClick={reset}>
                <RotateCcw aria-hidden /> Reset
              </Button>
            ) : null}
            <Select
              value={filters.account_id ?? 'all'}
              onValueChange={(v) => apply({ account_id: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="h-9 w-40" aria-label="Account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {(data?.accounts ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
              <SelectTrigger className="h-9 w-36" aria-label="Date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.filter((p) => p.value !== 'custom' || preset === 'custom').map(
                  (p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Select
              value={filters.direction ?? 'all'}
              onValueChange={(v) =>
                apply({ direction: v === 'all' ? undefined : (v as 'buy' | 'sell') })
              }
            >
              <SelectTrigger className="h-9 w-28" aria-label="Side">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both sides</SelectItem>
                <SelectItem value="buy">Long</SelectItem>
                <SelectItem value="sell">Short</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList className="h-9 w-full justify-start gap-1 overflow-x-auto bg-muted/50 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="h-7 shrink-0 text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {query.isLoading ? (
            <LoadingState />
          ) : query.isError ? (
            <div className="mt-3 rounded-md border border-border/70 bg-card p-4">
              <FormAlert tone="error">Couldn&apos;t load analytics.</FormAlert>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
                Retry
              </Button>
            </div>
          ) : !data?.summary || data.summary.kpis.totalTrades === 0 ? (
            <EmptyState data={data} tabs={TABS.map((t) => t.value)} tab={tab} />
          ) : (
            <>
              <TabsContent value="overview" className="mt-3">
                <OverviewTab data={data} onFilter={apply} />
              </TabsContent>
              <TabsContent value="performance" className="mt-3">
                <PerformanceTab data={data} />
              </TabsContent>
              <TabsContent value="risk" className="mt-3">
                <RiskTab data={data} />
              </TabsContent>
              <TabsContent value="symbols" className="mt-3">
                <SymbolsTab data={data} onFilter={apply} />
              </TabsContent>
              <TabsContent value="time" className="mt-3">
                <TimeTab data={data} />
              </TabsContent>
              <TabsContent value="behavior" className="mt-3">
                <BehaviorTab data={data} onTag={(id) => apply({ tag_ids: [id] })} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function LoadingState() {
  return (
    <div className="mt-3 space-y-3" aria-busy aria-label="Loading analytics">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-md border border-border/70 bg-muted/40"
          />
        ))}
      </div>
      <div className="h-[260px] animate-pulse rounded-md border border-border/70 bg-muted/40" />
    </div>
  );
}

function EmptyState({
  data,
  tab,
}: {
  data: AnalyticsWorkspaceData | undefined;
  tabs: readonly string[];
  tab: TabValue;
}) {
  void data;
  void tab;
  return (
    <div className="mt-3 space-y-3">
      <KpiSummary summary={null} />
      <SectionCard title="Equity curve">
        <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-medium">No analytics yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            No closed trades match the current filters. Log or import trades to populate every
            section — the layout stays the same.
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/journal/new">
                <Plus aria-hidden /> Add a trade
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/journal/import">
                <Download aria-hidden /> Import trades
              </Link>
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function KpiSummary({ summary }: { summary: AnalyticsWorkspaceData['summary'] }) {
  const k = summary?.kpis;
  const tone = (v: number | null | undefined) =>
    v === null || v === undefined
      ? null
      : v > 0
        ? ('profit' as const)
        : v < 0
          ? ('loss' as const)
          : null;
  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Stat
        label="Net P&L"
        value={money(k?.netProfit)}
        tone={tone(k?.netProfit)}
        hint="Realized net P&L (Σ net_pnl) across all closed trades matching the filters."
        context={
          k ? `${integer(k.totalTrades)} trades · ${integer(k.tradingDays)} days` : undefined
        }
      />
      <Stat
        label="Win rate"
        value={percent(k?.winRate)}
        hint="Winning trades ÷ decided trades (wins + losses + break-even)."
        context={k ? `${k.wins}W / ${k.losses}L / ${k.breakEven}BE` : undefined}
      />
      <Stat
        label="Profit factor"
        value={ratio(k?.profitFactor)}
        hint="Gross profit ÷ absolute gross loss. Unavailable when there are no losses."
      />
      <Stat
        label="Expectancy"
        value={money(k?.expectancy)}
        tone={tone(k?.expectancy)}
        hint="Net P&L ÷ decided trades — the average result per trade."
      />
      <Stat
        label="Avg win / loss"
        value={
          k && k.avgWin !== null && k.avgLoss !== null && k.avgLoss !== 0
            ? ratio(k.avgWin / Math.abs(k.avgLoss))
            : '—'
        }
        hint="Average winning trade ÷ magnitude of the average losing trade."
        context={k ? `${money(k.avgWin)} · ${money(k.avgLoss)}` : undefined}
      />
      <Stat
        label="Best / worst"
        value={money(k?.largestWin)}
        tone="profit"
        hint="Largest single winning and losing trade in the filtered set."
        context={k ? money(k.largestLoss) : undefined}
      />
    </div>
  );
}

function StreakRow({ data }: { data: AnalyticsWorkspaceData }) {
  const k = data.summary!.kpis;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Max win streak"
        value={integer(k.maxConsecutiveWins)}
        hint="Longest run of consecutive winning trades (chronological)."
      />
      <Stat
        label="Max loss streak"
        value={integer(k.maxConsecutiveLosses)}
        hint="Longest run of consecutive losing trades (chronological)."
      />
      <Stat
        label="Profitable days"
        value={percent(
          data.summary!.advanced.profitConsistency !== null
            ? data.summary!.advanced.profitConsistency / 100
            : null,
        )}
        hint="Share of trading days with a positive net result."
      />
      <Stat
        label="Avg hold"
        value={duration(k.avgHoldingSeconds)}
        hint="Average trade duration across trades with a recorded duration."
      />
    </div>
  );
}

function OverviewTab({
  data,
  onFilter,
}: {
  data: AnalyticsWorkspaceData;
  onFilter: (f: Partial<TradeFilters>) => void;
}) {
  const insights = buildInsights(data);
  return (
    <div className="space-y-3">
      <KpiSummary summary={data.summary} />
      <StreakRow data={data} />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SectionCard title="Equity curve — cumulative net P&L">
          <EquityChart points={data.summary!.equityCurve} />
        </SectionCard>
        <SectionCard title="Insights" className="min-h-0">
          {insights.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Not enough data for observations yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {insights.map((ins) => (
                <li key={ins.id} className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <p className="text-xs font-medium">{ins.text}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {ins.metric}
                    {ins.lowSample ? ' · low sample size' : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Top symbols by net P&L">
          <BreakdownBars
            rows={data.breakdowns.symbol ?? []}
            onSelect={(r) => onFilter({ symbol: r.key })}
          />
        </SectionCard>
        <SectionCard title="Net P&L by day of week">
          <BreakdownBars rows={orderDow(data.breakdowns.dayOfWeek ?? [])} />
        </SectionCard>
      </div>
    </div>
  );
}

function PerformanceTab({ data }: { data: AnalyticsWorkspaceData }) {
  return (
    <div className="space-y-3">
      <KpiSummary summary={data.summary} />
      <SectionCard title="Equity curve — cumulative net P&L">
        <EquityChart points={data.summary!.equityCurve} />
      </SectionCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Net P&L by month">
          <BreakdownBars
            rows={[...(data.breakdowns.month ?? [])].sort((a, b) => a.key.localeCompare(b.key))}
            max={12}
          />
        </SectionCard>
        <SectionCard title="Manual vs imported">
          <BreakdownKpiTable rows={data.breakdowns.source ?? []} dimensionLabel="Source" />
        </SectionCard>
      </div>
    </div>
  );
}

function RiskTab({ data }: { data: AnalyticsWorkspaceData }) {
  const dd = data.summary!.drawdown;
  const risk = data.summary!.risk;
  const distribution = pnlBuckets(data);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Max drawdown"
          value={money(-dd.maxDrawdown)}
          tone="loss"
          hint="Largest peak-to-trough decline of the cumulative net-P&L equity curve."
          context={`over ${dd.maxDrawdownDurationTrades} trades`}
        />
        <Stat
          label="Max drawdown %"
          value={percent(dd.maxDrawdownPct !== null ? dd.maxDrawdownPct / 100 : null)}
          hint="Max drawdown relative to the running equity peak."
        />
        <Stat
          label="Current drawdown"
          value={money(-dd.currentDrawdown)}
          tone={dd.currentDrawdown > 0 ? 'loss' : null}
          hint="Distance below the most recent equity peak."
        />
        <Stat
          label="Max loss streak"
          value={integer(data.summary!.kpis.maxConsecutiveLosses)}
          hint="Longest run of consecutive losing trades."
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="P&L distribution">
          <DistributionBars buckets={distribution} />
        </SectionCard>
        <SectionCard title="Planned risk">
          {risk.tradesWithRisk > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Avg risk / trade"
                value={money(risk.avgRiskAmount)}
                hint="Average recorded risk amount across trades that stored it."
              />
              <Stat
                label="Avg risk %"
                value={percent(risk.avgRiskPercent !== null ? risk.avgRiskPercent / 100 : null)}
                hint="Average recorded risk percent."
              />
              <Stat
                label="Max risk"
                value={money(risk.maxRiskAmount)}
                hint="Largest recorded risk amount."
              />
              <Stat
                label="With risk data"
                value={`${risk.tradesWithRisk}/${risk.tradesWithRisk + risk.tradesMissingRisk}`}
                hint="Trades that stored an initial risk amount."
              />
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No trades in this range recorded an initial risk amount, so planned-vs-realized risk
              cannot be computed.
            </p>
          )}
        </SectionCard>
      </div>
      <SectionCard title="Risk-adjusted metrics">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LockedStat
            label="Sharpe / Sortino"
            reason="Requires an annualized return series; only a per-trade, non-annualized proxy exists, so it is withheld to avoid a misleading figure."
          />
          <LockedStat
            label="Value at Risk"
            reason="Requires a modeled return distribution the app does not yet compute."
          />
          <LockedStat
            label="MAE / MFE"
            reason="Requires per-trade excursion data, which is not captured."
          />
          <LockedStat
            label="R-multiple"
            reason="Requires a stored initial-risk (R) on every trade; most trades have none."
          />
        </div>
      </SectionCard>
    </div>
  );
}

function SymbolsTab({
  data,
  onFilter,
}: {
  data: AnalyticsWorkspaceData;
  onFilter: (f: Partial<TradeFilters>) => void;
}) {
  const [sortKey, setSortKey] = useState<
    'netProfit' | 'totalTrades' | 'winRate' | 'profitFactor' | 'expectancy'
  >('netProfit');
  return (
    <div className="space-y-3">
      <SectionCard title="Symbols">
        <BreakdownKpiTable
          rows={data.breakdowns.symbol ?? []}
          dimensionLabel="Symbol"
          sortKey={sortKey}
          onSort={setSortKey}
          onSelect={(r) => onFilter({ symbol: r.key })}
        />
      </SectionCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Setups">
          <BreakdownKpiTable rows={data.breakdowns.setup ?? []} dimensionLabel="Setup" />
        </SectionCard>
        <SectionCard title="Playbooks (strategy)">
          {(data.breakdowns.strategy ?? []).length > 0 ? (
            <BreakdownKpiTable rows={data.breakdowns.strategy ?? []} dimensionLabel="Strategy" />
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No trades are linked to a playbook in this range.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function TimeTab({ data }: { data: AnalyticsWorkspaceData }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Net P&L by day of week">
          <BreakdownBars rows={orderDow(data.breakdowns.dayOfWeek ?? [])} max={7} />
        </SectionCard>
        <SectionCard title="Net P&L by hour of day (UTC)">
          <BreakdownBars
            rows={[...(data.breakdowns.hourOfDay ?? [])].sort((a, b) => a.key.localeCompare(b.key))}
            max={24}
          />
        </SectionCard>
      </div>
      <SectionCard title="Day of week">
        <BreakdownKpiTable rows={orderDow(data.breakdowns.dayOfWeek ?? [])} dimensionLabel="Day" />
      </SectionCard>
      <SectionCard title="Hour of day (UTC)">
        <BreakdownKpiTable
          rows={[...(data.breakdowns.hourOfDay ?? [])].sort((a, b) => a.key.localeCompare(b.key))}
          dimensionLabel="Hour"
        />
      </SectionCard>
    </div>
  );
}

function BehaviorTab({
  data,
  onTag,
}: {
  data: AnalyticsWorkspaceData;
  onTag: (id: string) => void;
}) {
  const dir = data.breakdowns.direction ?? [];
  const long = dir.find((r) => r.key === 'buy');
  const short = dir.find((r) => r.key === 'sell');
  const mistakes = data.tags.filter((t) => t.category === 'mistake');
  const otherTags = data.tags.filter((t) => t.category !== 'mistake');
  return (
    <div className="space-y-3">
      <SectionCard title="Long vs short">
        <div className="grid gap-3 sm:grid-cols-2">
          <SideCard label="Long" row={long} />
          <SideCard label="Short" row={short} />
        </div>
      </SectionCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Mistake tags">
          {mistakes.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No mistake-tagged trades in this range.
            </p>
          ) : (
            <TagList tags={mistakes} onTag={onTag} tone="loss" />
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Figures are associations over tagged trades, not causal claims.
          </p>
        </SectionCard>
        <SectionCard title="Other tags">
          {otherTags.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No other tags in this range.
            </p>
          ) : (
            <TagList tags={otherTags} onTag={onTag} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function SideCard({ label, row }: { label: string; row: BreakdownRow | undefined }) {
  if (!row) {
    return (
      <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
        No {label.toLowerCase()} trades in this range.
      </div>
    );
  }
  const k = row.kpis;
  return (
    <div className="rounded-md border border-border/70 p-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Net P&L</span>
        <span
          className={`text-right font-medium tabular-nums ${k.netProfit > 0 ? 'text-profit' : k.netProfit < 0 ? 'text-loss' : ''}`}
        >
          {money(k.netProfit)}
        </span>
        <span className="text-muted-foreground">Win rate</span>
        <span className="text-right tabular-nums">{percent(k.winRate)}</span>
        <span className="text-muted-foreground">Profit factor</span>
        <span className="text-right tabular-nums">{ratio(k.profitFactor)}</span>
        <span className="text-muted-foreground">Expectancy</span>
        <span className="text-right tabular-nums">{money(k.expectancy)}</span>
        <span className="text-muted-foreground">Trades</span>
        <span className="text-right tabular-nums">{integer(k.totalTrades)}</span>
      </div>
    </div>
  );
}

function TagList({
  tags,
  onTag,
  tone,
}: {
  tags: AnalyticsWorkspaceData['tags'];
  onTag: (id: string) => void;
  tone?: 'loss';
}) {
  return (
    <ul className="space-y-1.5">
      {tags.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onTag(t.id)}
            className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={`Filter by tag ${t.name}`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone === 'loss' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'}`}
              >
                {t.name}
              </span>
              <span className="text-[11px] text-muted-foreground">{t.count} trades</span>
            </span>
            <span
              className={`text-xs font-medium tabular-nums ${t.netPnl > 0 ? 'text-profit' : t.netPnl < 0 ? 'text-loss' : ''}`}
            >
              {money(t.netPnl)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function orderDow(rows: BreakdownRow[]): BreakdownRow[] {
  return [...rows].sort((a, b) => DOW_ORDER.indexOf(a.key) - DOW_ORDER.indexOf(b.key));
}

interface Bucket {
  label: string;
  count: number;
  positive: boolean;
}
function pnlBuckets(data: AnalyticsWorkspaceData): Bucket[] {
  // Deterministic, fixed buckets over the equity curve's per-trade deltas.
  const points = data.summary!.equityCurve;
  const deltas: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = i === 0 ? 0 : points[i - 1]!.equity;
    deltas.push(points[i]!.equity - prev);
  }
  const edges = [-Infinity, -500, -100, 0, 100, 500, Infinity];
  const labels = ['< -500', '-500 to -100', '-100 to 0', '0 to 100', '100 to 500', '> 500'];
  return labels.map((label, i) => ({
    label,
    count: deltas.filter((d) => d > edges[i]! && d <= edges[i + 1]!).length,
    positive: edges[i]! >= 0,
  }));
}

function DistributionBars({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <ul className="space-y-1.5">
      {buckets.map((b) => (
        <li key={b.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs text-muted-foreground">{b.label}</span>
          <span className="relative flex h-4 flex-1 items-center">
            <span
              className={`absolute h-2 rounded-sm ${b.positive ? 'bg-profit' : 'bg-loss'}`}
              style={{ width: `${(b.count / max) * 100}%` }}
              aria-hidden
            />
          </span>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums">{b.count}</span>
        </li>
      ))}
    </ul>
  );
}

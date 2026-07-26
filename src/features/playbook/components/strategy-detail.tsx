'use client';

/**
 * Playbook detail — the definition, its rules, and the real performance of the
 * trades linked to it.
 *
 * Every figure comes from `performance.ts` (the shared 9.8 engine) over trades
 * the user actually recorded. Nothing on this page is estimated, projected, or
 * illustrative, and no rule here is executed by MetaTradee — they are review
 * criteria the trader holds themselves to.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  Lock,
  Pencil,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FormAlert } from '@/features/auth/components/form-alert';
import { money, percent, ratio, integer, duration } from '@/features/analytics/format';
import { computeAdherenceRate, computeExecutionScore } from '../scores';
import { winLossRatio } from '../filters';
import { RULE_GROUP_META, RULE_GROUP_ORDER, STATUS_LABEL } from '../labels';
import {
  useDeleteStrategy,
  useDuplicateStrategy,
  usePinStrategy,
  useStrategyStatus,
} from '../hooks';
import type { PlaybookMetrics } from '../performance';
import type { PlaybookTradeRow } from '../server/queries';
import type { AdherenceRecord, StrategyRow } from '../types';

const SHARING_REASON =
  'Sharing is unavailable: MetaTradee has no playbook sharing or permission model yet.';

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card p-3">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums tracking-tight',
          tone === 'profit' && 'text-profit',
          tone === 'loss' && 'text-loss',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function LockedPanel({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Lock className="size-3.5" aria-hidden />
        {title}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{reason}</p>
    </div>
  );
}

function toneFor(value: number | null, trades: number): 'profit' | 'loss' | undefined {
  if (trades === 0 || value === null) return undefined;
  return value > 0 ? 'profit' : value < 0 ? 'loss' : undefined;
}

export function StrategyDetail({
  strategy,
  versions,
  metrics,
  trades,
  adherence,
  reviewedAvailable,
}: {
  strategy: StrategyRow;
  versions: { version: number; change_note: string | null; created_at: string }[];
  metrics: PlaybookMetrics;
  trades: PlaybookTradeRow[];
  adherence: AdherenceRecord[];
  reviewedAvailable: boolean;
}) {
  const router = useRouter();
  const pin = usePinStrategy();
  const status = useStrategyStatus();
  const remove = useDeleteStrategy();
  const duplicate = useDuplicateStrategy();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const kpis = metrics.kpis;
  const noTrades = kpis.totalTrades === 0;
  const archived = strategy.status === 'archived';
  const adherenceRate = computeAdherenceRate(adherence);
  const executionScore = computeExecutionScore(adherence);
  const rulesTotal = RULE_GROUP_ORDER.reduce(
    (total, group) => total + (strategy[group]?.length ?? 0),
    0,
  );

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setError('');
    try {
      await fn();
      after?.();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.');
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 px-2 text-xs text-muted-foreground"
              onClick={() => router.push('/playbook')}
            >
              <ArrowLeft className="size-3.5" aria-hidden /> All playbooks
            </Button>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-semibold tracking-tight">{strategy.name}</h1>
              <Badge variant={strategy.status === 'active' ? 'default' : 'secondary'}>
                {STATUS_LABEL[strategy.status] ?? strategy.status}
              </Badge>
              <span className="text-xs text-muted-foreground">v{strategy.current_version}</span>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {strategy.description ?? 'No description yet.'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {rulesTotal} rule{rulesTotal === 1 ? '' : 's'} · {strategy.checklist.length} checklist
              item{strategy.checklist.length === 1 ? '' : 's'} · updated{' '}
              {new Date(strategy.updated_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={strategy.is_pinned ? 'Unpin playbook' : 'Pin playbook'}
              aria-pressed={strategy.is_pinned}
              onClick={() =>
                void run(() => pin.mutateAsync({ id: strategy.id, pinned: !strategy.is_pinned }))
              }
            >
              <Star
                className={cn('size-4', strategy.is_pinned && 'fill-warning text-warning')}
                aria-hidden
              />
            </Button>
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link href={`/playbook/${strategy.id}/edit`}>
                <Pencil className="size-3.5" aria-hidden /> Edit
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={duplicate.isPending}
              onClick={() =>
                void run(async () => {
                  const result = await duplicate.mutateAsync(strategy.id);
                  if (result.data) router.push(`/playbook/${result.data.id}`);
                })
              }
            >
              <Copy className="size-3.5" aria-hidden /> Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() =>
                void run(() =>
                  status.mutateAsync({
                    id: strategy.id,
                    status: archived ? 'active' : 'archived',
                  }),
                )
              }
            >
              {archived ? (
                <>
                  <ArchiveRestore className="size-3.5" aria-hidden /> Restore
                </>
              ) : (
                <>
                  <Archive className="size-3.5" aria-hidden /> Archive
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled
              aria-disabled
              title={SHARING_REASON}
            >
              <Users className="size-3.5" aria-hidden /> Share
              <span className="sr-only"> — {SHARING_REASON}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-destructive"
              aria-label="Delete playbook"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        {error ? <FormAlert tone="error">{error}</FormAlert> : null}

        {/* Performance — real linked trades only */}
        <section aria-labelledby="playbook-performance" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="playbook-performance" className="text-sm font-semibold tracking-tight">
              Performance
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link href={`/journal?strategy=${encodeURIComponent(strategy.id)}`}>
                <ExternalLink className="size-3.5" aria-hidden /> Open these trades in Journal
              </Link>
            </Button>
          </div>

          {noTrades ? (
            <p className="rounded-md border border-dashed border-border bg-card/40 px-4 py-6 text-center text-xs leading-5 text-muted-foreground">
              No trades are linked to this playbook yet. Link a trade from the Journal (or set its
              playbook when logging it) and its expectancy, win rate, and profit factor appear here
              — computed from those trades, never estimated.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            <Stat label="Trades" value={integer(kpis.totalTrades)} />
            <Stat
              label="Net P&L"
              value={noTrades ? '—' : money(kpis.netProfit)}
              tone={toneFor(kpis.netProfit, kpis.totalTrades)}
            />
            <Stat
              label="Win rate"
              value={kpis.winRate === null ? '—' : percent(kpis.winRate, 1)}
              hint={noTrades ? undefined : `${kpis.wins}W / ${kpis.losses}L`}
            />
            <Stat label="Profit factor" value={ratio(kpis.profitFactor)} />
            <Stat
              label="Expectancy"
              value={money(kpis.expectancy)}
              tone={toneFor(kpis.expectancy, kpis.totalTrades)}
              hint="Per decided trade"
            />
            <Stat label="Avg W/L" value={ratio(winLossRatio(kpis))} />
            <Stat
              label="Avg winner"
              value={kpis.avgWin === null ? '—' : money(kpis.avgWin)}
              tone={kpis.avgWin === null ? undefined : 'profit'}
            />
            <Stat
              label="Avg loser"
              value={kpis.avgLoss === null ? '—' : money(-Math.abs(kpis.avgLoss))}
              tone={kpis.avgLoss === null ? undefined : 'loss'}
            />
            <Stat
              label="Best trade"
              value={kpis.largestWin === null ? '—' : money(kpis.largestWin)}
              tone={kpis.largestWin === null ? undefined : 'profit'}
            />
            <Stat
              label="Worst trade"
              value={kpis.largestLoss === null ? '—' : money(-Math.abs(kpis.largestLoss))}
              tone={kpis.largestLoss === null ? undefined : 'loss'}
            />
            <Stat label="Avg duration" value={duration(kpis.avgHoldingSeconds)} />
            <Stat
              label="Reviewed"
              value={
                !reviewedAvailable || metrics.reviewedRate === null
                  ? '—'
                  : percent(metrics.reviewedRate, 0)
              }
              hint={reviewedAvailable ? undefined : 'Migration not applied'}
            />
          </div>

          {!noTrades ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border/70 bg-card p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Long vs short
                </p>
                <div className="mt-1.5 flex items-center justify-between text-sm tabular-nums">
                  <span className="text-muted-foreground">Long</span>
                  <span
                    className={cn(
                      metrics.longNetPnl === null
                        ? 'text-muted-foreground'
                        : metrics.longNetPnl >= 0
                          ? 'text-profit'
                          : 'text-loss',
                    )}
                  >
                    {metrics.longNetPnl === null ? '—' : money(metrics.longNetPnl)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm tabular-nums">
                  <span className="text-muted-foreground">Short</span>
                  <span
                    className={cn(
                      metrics.shortNetPnl === null
                        ? 'text-muted-foreground'
                        : metrics.shortNetPnl >= 0
                          ? 'text-profit'
                          : 'text-loss',
                    )}
                  >
                    {metrics.shortNetPnl === null ? '—' : money(metrics.shortNetPnl)}
                  </span>
                </div>
              </div>
              <div className="rounded-md border border-border/70 bg-card p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Symbols traded
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {metrics.symbols.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    metrics.symbols.slice(0, 12).map((symbol) => (
                      <span
                        key={symbol}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {symbol}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Rules / trades / adherence / history */}
        <Tabs defaultValue="rules">
          <TabsList className="h-9 w-full justify-start gap-1 bg-muted/50 p-1">
            <TabsTrigger value="rules" className="h-7 text-xs">
              Rules &amp; checklist
            </TabsTrigger>
            <TabsTrigger value="trades" className="h-7 text-xs">
              Linked trades
            </TabsTrigger>
            <TabsTrigger value="adherence" className="h-7 text-xs">
              Adherence
            </TabsTrigger>
            <TabsTrigger value="history" className="h-7 text-xs">
              Version history
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-3 space-y-3">
            <p className="text-[11px] leading-4 text-muted-foreground">
              These rules are your own review criteria. MetaTradee records and measures them — it
              does not place, manage, or automate any trade.
            </p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {RULE_GROUP_ORDER.filter((group) => (strategy[group]?.length ?? 0) > 0).map(
                (group) => (
                  <section
                    key={group}
                    className="rounded-md border border-border/70 bg-card p-3"
                    aria-labelledby={`rules-${group}`}
                  >
                    <h3 id={`rules-${group}`} className="text-xs font-semibold">
                      {RULE_GROUP_META[group].label}
                    </h3>
                    <ul className="mt-1.5 space-y-1">
                      {strategy[group].map((rule) => (
                        <li key={rule.id} className="flex gap-1.5 text-xs leading-5">
                          <span aria-hidden className="text-muted-foreground">
                            •
                          </span>
                          <span className="text-muted-foreground">
                            {rule.text}
                            {rule.required ? (
                              <span className="ml-1 rounded bg-primary/10 px-1 text-[9px] font-semibold uppercase text-primary">
                                Required
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ),
              )}
              {rulesTotal === 0 ? (
                <p className="col-span-full rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                  No rules recorded yet. Edit this playbook to add entry, invalidation, risk, and
                  exit criteria.
                </p>
              ) : null}
            </div>

            {strategy.checklist.length > 0 ? (
              <section className="rounded-md border border-border/70 bg-card p-3">
                <h3 className="text-xs font-semibold">Pre-trade checklist</h3>
                <ol className="mt-1.5 space-y-1">
                  {strategy.checklist.map((item, index) => (
                    <li key={item.id} className="flex gap-2 text-xs leading-5">
                      <span className="tabular-nums text-muted-foreground">{index + 1}.</span>
                      <span className="text-muted-foreground">
                        {item.text}
                        {item.required ? (
                          <span className="ml-1 rounded bg-primary/10 px-1 text-[9px] font-semibold uppercase text-primary">
                            Required
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {strategy.notes ? (
              <section className="rounded-md border border-border/70 bg-card p-3">
                <h3 className="text-xs font-semibold">Notes</h3>
                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                  {strategy.notes}
                </p>
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="trades" className="mt-3">
            {trades.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                No trades linked yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/70 bg-card">
                <table className="w-full min-w-[680px] border-collapse text-xs">
                  <caption className="sr-only">Trades linked to {strategy.name}</caption>
                  <thead className="bg-muted/60 text-[11px] text-muted-foreground">
                    <tr className="border-b border-border/70">
                      <th scope="col" className="px-3 py-2 text-left">
                        Closed
                      </th>
                      <th scope="col" className="px-3 py-2 text-left">
                        Symbol
                      </th>
                      <th scope="col" className="px-3 py-2 text-left">
                        Side
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Qty
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        R
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Duration
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Net P&L
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-2">
                          <Link
                            href={`/journal/${trade.id}`}
                            className="text-muted-foreground hover:text-primary"
                          >
                            {trade.closed_at
                              ? new Date(trade.closed_at).toLocaleDateString('en-GB')
                              : 'Open'}
                          </Link>
                        </td>
                        <td className="px-3 py-2 font-medium">{trade.symbol}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {trade.direction === 'buy' ? 'Long' : 'Short'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {trade.quantity ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {ratio(trade.rr_ratio)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {duration(trade.duration_seconds)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 text-right font-medium tabular-nums',
                            trade.net_pnl === null
                              ? 'text-muted-foreground'
                              : trade.net_pnl > 0
                                ? 'text-profit'
                                : trade.net_pnl < 0
                                  ? 'text-loss'
                                  : '',
                          )}
                        >
                          {trade.net_pnl === null ? '—' : money(trade.net_pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="adherence" className="mt-3">
            {adherence.length === 0 ? (
              <LockedPanel
                title="Rule adherence not recorded"
                reason="Adherence appears only when it is actually recorded against a trade — whether you followed the playbook, which rules were broken, and your execution quality. MetaTradee will not estimate an adherence score from P&L, because a profitable trade does not prove a rule was followed."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat
                  label="Trades reviewed for adherence"
                  value={integer(adherence.length)}
                  hint={`of ${integer(kpis.totalTrades)} linked`}
                />
                <Stat
                  label="Followed the playbook"
                  value={adherenceRate === null ? '—' : `${adherenceRate}%`}
                  hint="Self-recorded on the trade"
                />
                <Stat
                  label="Avg execution quality"
                  value={executionScore === null ? '—' : `${executionScore}/100`}
                  hint="Self-recorded on the trade"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            <ul className="divide-y divide-border/60 rounded-md border border-border/70 bg-card text-xs">
              {versions.map((version) => (
                <li
                  key={version.version}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="font-medium">v{version.version}</span>{' '}
                    <span className="text-muted-foreground">{version.change_note}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(version.created_at).toLocaleString('en-GB')}
                  </span>
                </li>
              ))}
              {versions.length === 0 ? (
                <li className="px-3 py-6 text-center text-muted-foreground">
                  No version history recorded.
                </li>
              ) : null}
            </ul>
          </TabsContent>
        </Tabs>

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete “{strategy.name}”?</DialogTitle>
              <DialogDescription>
                {kpis.totalTrades > 0
                  ? `${kpis.totalTrades} linked trade${kpis.totalTrades === 1 ? '' : 's'} will be kept and unlinked from this playbook. No trade is deleted.`
                  : 'This playbook has no linked trades. No trade data is affected.'}
              </DialogDescription>
            </DialogHeader>
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() =>
                  void run(
                    () => remove.mutateAsync(strategy.id),
                    () => router.push('/playbook'),
                  )
                }
              >
                {remove.isPending ? 'Deleting…' : 'Delete playbook'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

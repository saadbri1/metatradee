'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/features/analytics/components/stat-card';
import { Money, Rr } from '@/features/journal/components/pnl';
import {
  useStrategyPerformance,
  usePinStrategy,
  useDeleteStrategy,
  useStrategyStatus,
  useRestoreVersion,
} from '../hooks';
import { RULE_GROUPS, type RuleGroup, type StrategyRow } from '../types';

const RULE_LABELS: Record<RuleGroup, string> = {
  entry_rules: 'Entry',
  exit_rules: 'Exit',
  stop_loss_rules: 'Stop-loss',
  take_profit_rules: 'Take-profit',
  position_sizing_rules: 'Position sizing',
  risk_rules: 'Risk',
  confirmation_rules: 'Confirmation',
  invalidation_rules: 'Invalidation',
};

export function StrategyDetail({
  strategy,
  versions,
}: {
  strategy: StrategyRow;
  versions: { version: number; change_note: string | null; created_at: string }[];
}) {
  const router = useRouter();
  const perf = useStrategyPerformance(strategy.id);
  const pin = usePinStrategy();
  const del = useDeleteStrategy();
  const status = useStrategyStatus();
  const restore = useRestoreVersion();
  const k = perf.data?.kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{strategy.name}</h1>
          <Badge variant={strategy.status === 'active' ? 'default' : 'secondary'}>
            {strategy.status}
          </Badge>
          <span className="text-xs text-muted-foreground">v{strategy.current_version}</span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={strategy.is_pinned ? 'Unpin' : 'Pin'}
            aria-pressed={strategy.is_pinned}
            onClick={() => pin.mutate({ id: strategy.id, pinned: !strategy.is_pinned })}
          >
            <Star className={strategy.is_pinned ? 'fill-warning text-warning' : ''} aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Edit" asChild>
            <Link href={`/playbook/${strategy.id}/edit`}>
              <Pencil aria-hidden />
            </Link>
          </Button>
          {strategy.status !== 'archived' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => status.mutate({ id: strategy.id, status: 'archived' })}
            >
              Archive
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => status.mutate({ id: strategy.id, status: 'active' })}
            >
              Activate
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            onClick={() =>
              del.mutate(strategy.id, { onSuccess: (r) => r.ok && router.push('/playbook') })
            }
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>

      {/* Performance (reused 9.8 — reconciles with Analytics) */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Performance</h2>
        {perf.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : k ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Net P&L" value={<Money value={k.netProfit} colored />} />
            <StatCard
              label="Win rate"
              value={k.winRate === null ? '—' : `${(k.winRate * 100).toFixed(1)}%`}
            />
            <StatCard label="Profit factor" value={k.profitFactor?.toFixed(2) ?? '—'} />
            <StatCard label="Expectancy" value={<Money value={k.expectancy} colored />} />
            <StatCard label="Avg R:R" value={<Rr value={k.avgRr} />} />
            <StatCard label="Trades" value={k.totalTrades} />
            <StatCard label="Health" value={perf.data?.health ?? '—'} context="composite" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No trades linked to this strategy yet.</p>
        )}
      </section>

      {/* Rule groups */}
      <section className="grid gap-4 sm:grid-cols-2">
        {RULE_GROUPS.filter((g) => strategy[g]?.length > 0).map((g) => (
          <div key={g} className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold">{RULE_LABELS[g]}</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {strategy[g].map((r) => (
                <li key={r.id}>
                  {r.required ? '• (required) ' : '• '}
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {strategy.checklist.length > 0 ? (
        <section className="rounded-lg border border-border p-3">
          <h3 className="mb-2 text-sm font-semibold">Checklist</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {strategy.checklist.map((c) => (
              <li key={c.id}>
                {c.required ? '☑ (required) ' : '☐ '}
                {c.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Version history */}
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">Version history</h2>
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {versions.map((v) => (
            <li key={v.version} className="flex items-center justify-between gap-3 p-3">
              <span>
                <span className="font-medium">v{v.version}</span>{' '}
                <span className="text-muted-foreground">{v.change_note}</span>
              </span>
              {v.version !== strategy.current_version ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restore.mutate({ id: strategy.id, version: v.version })}
                  disabled={restore.isPending}
                >
                  Restore
                </Button>
              ) : (
                <Badge variant="outline">current</Badge>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Dashboard Overview (Phase 10.0) — the real, data-aware landing that replaces
 * the placeholder. Server component: it renders REAL user-scoped data or honest
 * empty states. No fabricated statistics, no fake curve. Reuses the analytics
 * EquityChart, journal PnL display, and shared EmptyState.
 */
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Circle,
  ClipboardList,
  Plus,
  Upload,
  Activity as ActivityIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/features/workspace/components/states';
import { EquityChart } from '@/features/analytics/components/equity-chart';
import { Money } from '@/features/journal/components/pnl';
import { KpiCards } from './kpi-cards';
import { buildKpiCards } from '../kpi';
import { checklistProgress } from '../checklist';
import type { DashboardData } from '../server/queries';

function WelcomeHeader({ name, onboardingDone }: { name: string; onboardingDone: boolean }) {
  const now = new Date();
  const hour = now.getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {part}, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{today}</p>
      </div>
      <Button asChild>
        <Link href={onboardingDone ? '/journal' : '/onboarding'}>
          {onboardingDone ? 'Log a trade' : 'Finish setup'} <ArrowRight aria-hidden />
        </Link>
      </Button>
    </header>
  );
}

const QUICK_ACTIONS = [
  { label: 'Add account', href: '/settings/trading', icon: Plus },
  { label: 'Add strategy', href: '/playbook', icon: ClipboardList },
  { label: 'Import trades', href: '/journal', icon: Upload },
  { label: 'Open journal', href: '/journal', icon: BarChart3 },
  { label: 'Update profile', href: '/settings/profile', icon: Circle },
] as const;

export function DashboardOverview({ name, data }: { name: string; data: DashboardData }) {
  const cards = buildKpiCards(data.kpis, data.streak);
  const progress = checklistProgress(data.checklist);
  const equityPoints = data.equity.map((p) => ({ ...p }));

  return (
    <div className="space-y-6">
      <WelcomeHeader name={name} onboardingDone={data.checklist[1]?.done ?? false} />

      {/* Setup checklist — shown until everything is done. */}
      {progress < 100 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Get set up</CardTitle>
            <Badge variant="secondary" aria-label={`${progress} percent complete`}>
              {progress}%
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.checklist.map((item) => {
                const inner = (
                  <span className="flex items-center gap-2 text-sm">
                    {item.done ? (
                      <CheckCircle2 className="size-4 text-profit" aria-hidden />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" aria-hidden />
                    )}
                    <span className={item.done ? 'text-muted-foreground line-through' : ''}>
                      {item.label}
                    </span>
                  </span>
                );
                return (
                  <li key={item.id}>
                    {item.href && !item.done ? (
                      <Link
                        href={item.href}
                        className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI cards — real engine values or honest zeros. */}
      <KpiCards cards={cards} />

      {/* Performance + activity. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-label="Performance overview">
          <EquityChart points={equityPoints} />
        </section>

        <section aria-label="Recent activity">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data.activity.length > 0 ? (
                <ul className="space-y-2">
                  {data.activity.map((a, i) => (
                    <li key={`${a.at}-${i}`} className="flex items-start gap-2 text-sm">
                      <ActivityIcon
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="flex-1">{a.label}</span>
                      <time className="text-xs text-muted-foreground" dateTime={a.at}>
                        {new Date(a.at).toLocaleDateString()}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your recent actions will appear here as you use MetaTradee.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Recent trades — real rows or an honest empty state. */}
      <section aria-label="Recent trades">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Recent trades</CardTitle>
            {data.recentTrades.length > 0 ? (
              <Button asChild size="sm" variant="ghost">
                <Link href="/journal">View all</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {data.recentTrades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Your five most recent trades</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">
                        Symbol
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        Side
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right">
                        P&amp;L
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right">
                        Closed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTrades.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-medium">
                          <Link href={`/journal/${t.id}`} className="hover:underline">
                            {t.symbol}
                          </Link>
                        </th>
                        <td className="py-2 pr-3 capitalize">{t.direction}</td>
                        <td className="py-2 pr-3 text-right">
                          <Money value={t.net_pnl} />
                        </td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">
                          {t.closed_at ? new Date(t.closed_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<BarChart3 className="size-8" />}
                title="No trades yet"
                description="Once you log or import trades, your recent activity and performance will show up here."
                action={
                  <Button asChild size="sm">
                    <Link href="/journal">Go to journal</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick actions. */}
      <section aria-label="Quick actions">
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Button key={a.label} asChild variant="outline" size="sm">
              <Link href={a.href}>
                <a.icon aria-hidden /> {a.label}
              </Link>
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchAnalyticsTrades } from '@/features/analytics/server/queries';
import {
  getPlaybookAdherence,
  getPlaybookTrades,
  getStrategy,
  getStrategyVersions,
} from '@/features/playbook/server/queries';
import { computeMetrics } from '@/features/playbook/performance';
import { StrategyDetail } from '@/features/playbook/components/strategy-detail';

export const metadata: Metadata = { title: 'Playbook' };

export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const strategy = await getStrategy(supabase, user.id, id);
  if (!strategy) notFound();

  // Metrics come from the same engine and the same trade set the Analytics
  // workspace uses, so a playbook's numbers reconcile with it exactly.
  const [versions, analyticsTrades, trades, adherence] = await Promise.all([
    getStrategyVersions(supabase, user.id, id),
    fetchAnalyticsTrades(supabase, user.id, { strategy_id: id }),
    getPlaybookTrades(supabase, user.id, id),
    getPlaybookAdherence(supabase, user.id, id),
  ]);

  return (
    <StrategyDetail
      strategy={strategy}
      versions={versions}
      metrics={computeMetrics(analyticsTrades)}
      trades={trades}
      adherence={adherence}
      reviewedAvailable={analyticsTrades.some((trade) => typeof trade.reviewed === 'boolean')}
    />
  );
}

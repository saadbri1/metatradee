import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStrategy } from '@/features/playbook/server/queries';
import { StrategyBuilder } from '@/features/playbook/components/strategy-builder';
import { RULE_GROUPS } from '@/features/playbook/types';
import type { StrategyCreateInput } from '@/features/playbook/schemas';

export const metadata: Metadata = { title: 'Edit strategy' };

export default async function EditStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const s = await getStrategy(supabase, user.id, id);
  if (!s) notFound();

  const ruleGroups = Object.fromEntries(RULE_GROUPS.map((g) => [g, s[g] ?? []]));
  const defaults: Partial<StrategyCreateInput> = {
    name: s.name,
    description: s.description ?? '',
    category: s.category ?? '',
    market: s.market ?? '',
    asset_class: s.asset_class ?? '',
    color: s.color ?? '',
    symbols: s.symbols,
    timeframes: s.timeframes,
    sessions: s.sessions,
    checklist: s.checklist,
    notes: s.notes ?? '',
    status: s.status,
    ...ruleGroups,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Edit strategy</h1>
      <StrategyBuilder mode="edit" strategyId={id} defaultValues={defaults} />
    </div>
  );
}

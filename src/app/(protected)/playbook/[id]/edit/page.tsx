import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { getStrategy, listStrategies } from '@/features/playbook/server/queries';
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

  const existing = await listStrategies(supabase, user.id);

  return (
    <div className="mx-auto max-w-[1100px] space-y-3">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 px-2 text-xs text-muted-foreground"
          asChild
        >
          <Link href={`/playbook/${id}`}>
            <ArrowLeft className="size-3.5" aria-hidden /> Back to {s.name}
          </Link>
        </Button>
        <h1 className="mt-1 font-display text-xl font-semibold tracking-tight">Edit playbook</h1>
        <p className="text-xs text-muted-foreground">
          Saving a rule change records a new version — earlier versions stay in the history.
        </p>
      </div>
      <StrategyBuilder
        mode="edit"
        strategyId={id}
        defaultValues={defaults}
        existingNames={existing.map((strategy) => strategy.name)}
      />
    </div>
  );
}

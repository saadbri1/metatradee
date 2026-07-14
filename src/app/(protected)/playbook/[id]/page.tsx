import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStrategy, getStrategyVersions } from '@/features/playbook/server/queries';
import { StrategyDetail } from '@/features/playbook/components/strategy-detail';

export const metadata: Metadata = { title: 'Strategy' };

export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const strategy = await getStrategy(supabase, user.id, id);
  if (!strategy) notFound();
  const versions = await getStrategyVersions(supabase, user.id, id);

  return (
    <div className="mx-auto max-w-4xl">
      <StrategyDetail strategy={strategy} versions={versions} />
    </div>
  );
}

import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { listStrategies } from '@/features/playbook/server/queries';
import { StrategyList } from '@/features/playbook/components/strategy-list';

export const metadata: Metadata = { title: 'Playbook' };

export default async function PlaybookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const strategies = user ? await listStrategies(supabase, user.id) : [];
  return <StrategyList strategies={strategies} />;
}

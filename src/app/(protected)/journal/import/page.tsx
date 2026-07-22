import type { Metadata } from 'next';
import { ImportWizard } from '@/features/import/components/import-wizard';
import { requireAuth } from '@/features/auth/server/session';
import { createClient } from '@/lib/supabase/server';
import { listTradingAccounts } from '@/features/accounts/server/queries';

export const metadata: Metadata = { title: 'Import Trades' };

export default async function ImportPage() {
  const user = await requireAuth('/journal/import');
  const supabase = await createClient();
  const accounts = await listTradingAccounts(supabase, user.id);
  return <ImportWizard accounts={accounts.filter((account) => account.status !== 'archived')} />;
}

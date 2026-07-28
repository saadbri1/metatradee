import type { Metadata } from 'next';
import { ImportWizard } from '@/features/import/components/import-wizard';
import { requireAuth } from '@/features/auth/server/session';
import { createClient } from '@/lib/supabase/server';
import { listTradingAccounts } from '@/features/accounts/server/queries';
import { getEntitlement } from '@/features/billing/server/queries';
import { hasFeature } from '@/features/billing/entitlements';
import { FeatureLocked } from '@/features/billing/components/feature-locked';
import { gateForPath } from '@/features/billing/access';

export const metadata: Metadata = { title: 'Import Trades' };

const GATE = gateForPath('/journal/import')!;

export default async function ImportPage() {
  const user = await requireAuth('/journal/import');
  const supabase = await createClient();

  // Gate BEFORE loading accounts: an unentitled viewer gets no workspace data
  // and no wizard, matching the server actions that already refuse the import.
  const entitlement = await getEntitlement(supabase, user.id);
  if (!hasFeature(entitlement, GATE.feature)) {
    return (
      <FeatureLocked
        title={GATE.title}
        description={GATE.description}
        feature={GATE.feature}
        currentTier={entitlement.tier}
      />
    );
  }

  const accounts = await listTradingAccounts(supabase, user.id);
  return <ImportWizard accounts={accounts.filter((account) => account.status !== 'archived')} />;
}

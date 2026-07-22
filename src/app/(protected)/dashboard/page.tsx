import type { Metadata } from 'next';
import { requireAuth } from '@/features/auth/server/session';
import { getProfile } from '@/features/workspace/server/queries';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData } from '@/features/dashboard/server/queries';
import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  // Auth + onboarding are already enforced by the (protected) layout; this
  // re-reads the user to scope every query to them (RLS + explicit user_id).
  const user = await requireAuth();
  const supabase = await createClient();
  const profile = await getProfile();

  const data = await getDashboardData(supabase, user.id, profile?.timezone || 'UTC');

  const name = profile?.display_name || user.email?.split('@')[0] || 'Trader';
  return <DashboardOverview name={name} data={data} />;
}

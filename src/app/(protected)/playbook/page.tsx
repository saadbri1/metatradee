import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getPlaybookWorkspace } from '@/features/playbook/server/queries';
import { PlaybookWorkspace } from '@/features/playbook/components/playbook-workspace';

export const metadata: Metadata = { title: 'Playbook' };

export default async function PlaybookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Server-render the first payload so the workspace paints populated rather
  // than flashing a skeleton on every navigation.
  const initialData = user
    ? await getPlaybookWorkspace(supabase, user.id)
    : { rows: [], categories: [], symbols: [], reviewedAvailable: false };

  return (
    <Suspense fallback={null}>
      <PlaybookWorkspace initialData={initialData} />
    </Suspense>
  );
}

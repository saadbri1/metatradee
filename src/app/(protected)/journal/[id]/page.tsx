import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTrade } from '@/features/journal/server/queries';
import { TradeDetail } from '@/features/journal/components/trade-detail';

export const metadata: Metadata = { title: 'Trade' };

export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const trade = await getTrade(supabase, user.id, id);
  if (!trade) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <TradeDetail trade={trade} />
    </div>
  );
}

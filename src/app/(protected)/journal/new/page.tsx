import type { Metadata } from 'next';
import { TradeForm } from '@/features/journal/components/trade-form';

export const metadata: Metadata = { title: 'New trade' };

export default function NewTradePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">New trade</h1>
      <TradeForm mode="create" />
    </div>
  );
}

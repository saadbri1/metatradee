import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TradeList } from '@/features/journal/components/trade-list';
import { FormSkeleton } from '@/features/workspace/components/states';

export const metadata: Metadata = { title: 'Journal' };

export default function JournalPage() {
  // TradeList reads the URL (useSearchParams) → needs a Suspense boundary.
  return (
    <Suspense fallback={<FormSkeleton rows={8} />}>
      <TradeList />
    </Suspense>
  );
}

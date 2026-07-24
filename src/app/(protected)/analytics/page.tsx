import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AnalyticsWorkspace } from '@/features/analytics/components/analytics-workspace';
import { FormSkeleton } from '@/features/workspace/components/states';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  // AnalyticsWorkspace reads the URL (useSearchParams) → needs a Suspense boundary.
  return (
    <Suspense fallback={<FormSkeleton rows={6} />}>
      <AnalyticsWorkspace />
    </Suspense>
  );
}

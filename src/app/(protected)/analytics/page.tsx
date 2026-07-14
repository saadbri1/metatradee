import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AnalyticsDashboard } from '@/features/analytics/components/analytics-dashboard';
import { FormSkeleton } from '@/features/workspace/components/states';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  // AnalyticsDashboard reads the URL (useSearchParams) → needs a Suspense boundary.
  return (
    <Suspense fallback={<FormSkeleton rows={6} />}>
      <AnalyticsDashboard />
    </Suspense>
  );
}

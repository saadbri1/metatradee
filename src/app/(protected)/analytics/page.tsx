import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AnalyticsWorkspace } from '@/features/analytics/components/analytics-workspace';
import { FormSkeleton } from '@/features/workspace/components/states';
import { checkFeatureAccess } from '@/features/billing/server/guard';
import { FeatureLocked } from '@/features/billing/components/feature-locked';
import { gateForPath } from '@/features/billing/access';

export const metadata: Metadata = { title: 'Analytics' };

const GATE = gateForPath('/analytics')!;

export default async function AnalyticsPage() {
  const { allowed, entitlement } = await checkFeatureAccess(GATE.feature);
  if (!allowed) {
    return (
      <FeatureLocked
        title={GATE.title}
        description={GATE.description}
        feature={GATE.feature}
        currentTier={entitlement.tier}
      />
    );
  }

  // AnalyticsWorkspace reads the URL (useSearchParams) → needs a Suspense boundary.
  return (
    <Suspense fallback={<FormSkeleton rows={6} />}>
      <AnalyticsWorkspace />
    </Suspense>
  );
}

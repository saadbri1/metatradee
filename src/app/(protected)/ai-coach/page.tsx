import type { Metadata } from 'next';
import { AICoachDashboard } from '@/features/ai-coach/components/ai-coach-dashboard';
import { checkFeatureAccess } from '@/features/billing/server/guard';
import { FeatureLocked } from '@/features/billing/components/feature-locked';
import { gateForPath } from '@/features/billing/access';

export const metadata: Metadata = { title: 'AI Coach' };

const GATE = gateForPath('/ai-coach')!;

/**
 * Server-side entitlement gate. Without it a Free user reaching this URL
 * directly received the whole coach UI, with every action failing at the
 * server. The gated tree is now never rendered for an unentitled viewer.
 */
export default async function AICoachPage() {
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
  return <AICoachDashboard />;
}

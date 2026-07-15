'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/features/workspace/components/states';

/** Dashboard error boundary — honest message + retry, never a blank page. */
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      title="We couldn't load your dashboard"
      description="Something went wrong fetching your data. This is on our side — please try again."
      action={
        <Button onClick={reset} variant="outline">
          Retry
        </Button>
      }
    />
  );
}

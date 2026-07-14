import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalendarDashboard } from '@/features/calendar/components/calendar-dashboard';
import { FormSkeleton } from '@/features/workspace/components/states';

export const metadata: Metadata = { title: 'Calendar' };

export default function CalendarPage() {
  // CalendarDashboard reads the URL (useSearchParams) → needs a Suspense boundary.
  return (
    <Suspense fallback={<FormSkeleton rows={6} />}>
      <CalendarDashboard />
    </Suspense>
  );
}

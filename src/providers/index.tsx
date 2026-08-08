'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from './theme-provider';
import { QueryProvider } from './query-provider';
import { AnalyticsProvider } from '@/lib/analytics/analytics-provider';

/**
 * Single composition point for all client-side providers.
 *
 * `AnalyticsProvider` renders no UI — it installs the event sink and reports
 * organic landings. It sits OUTSIDE the tree that renders `children` so a
 * render error in the app cannot take the beacon down with it, and so it never
 * re-renders the page when it updates.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>{children}</QueryProvider>
      <AnalyticsProvider />
    </ThemeProvider>
  );
}

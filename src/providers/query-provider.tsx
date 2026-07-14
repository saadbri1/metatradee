'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Server-state provider. One QueryClient per browser session.
 * Defaults tuned for a data app: no refetch-on-focus spam, sane staleness.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 min
            gcTime: 5 * 60 * 1000, // 5 min
            refetchOnWindowFocus: false,
            retry: 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

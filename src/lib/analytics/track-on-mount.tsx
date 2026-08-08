'use client';

/**
 * Fires one event when a page mounts.
 *
 * EXISTS SO SERVER PAGES STAY SERVER PAGES. `/pricing` and the tool pages are
 * statically prerendered, and that is load-bearing for SEO — turning one into a
 * client component to report a view would trade an indexing property for a
 * metric. This is a leaf: the page stays server-rendered and gains a few bytes.
 *
 * Fires ONCE per mount, not per render, and never on the server.
 */
import { useEffect, useRef } from 'react';
import { trackEvent } from './analytics';
import type { AnalyticsEventName, PropsFor } from './events';

export function TrackOnMount<N extends AnalyticsEventName>({
  event,
  props,
}: {
  event: N;
  props: PropsFor<N>;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent(event, props);
    // Intentionally mount-only: re-firing on a prop identity change would
    // report a view that did not happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

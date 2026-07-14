'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Accessibility: move focus to the main content region on route change (after
 * the first render) so keyboard/screen-reader users land at the new page rather
 * than keeping focus on a stale nav item. The target is `#main-content`
 * (tabIndex -1). Honors reduced motion by not scrolling smoothly.
 */
export function useFocusOnRouteChange(): void {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const main = document.getElementById('main-content');
    main?.focus({ preventScroll: false });
  }, [pathname]);
}

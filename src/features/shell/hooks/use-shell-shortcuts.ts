'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store/ui-store';

/**
 * Global shell keyboard shortcuts. ⌘K / Ctrl+K toggles the command palette.
 * Feature-specific shortcuts (e.g. journal's `N`) are registered by their own
 * features, not here.
 */
export function useShellShortcuts(): void {
  const toggle = useUIStore((s) => s.toggleCommandPalette);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);
}

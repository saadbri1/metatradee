'use client';

import { Search } from 'lucide-react';
import { useUIStore } from '@/store/ui-store';

/**
 * Search affordance. This phase it only opens the command palette (no search
 * backend); the palette's Search category is the extension point.
 */
export function SearchTrigger() {
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex h-9 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      aria-label="Search — open command palette"
    >
      <Search className="size-4" aria-hidden />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="hidden rounded border border-border px-1.5 font-mono text-[10px] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

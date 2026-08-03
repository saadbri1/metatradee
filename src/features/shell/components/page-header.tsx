'use client';

import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';

/**
 * THE workspace header. One bar, every authenticated route.
 *
 * There were two. `TopBar` served most routes at `h-[76px]` with
 * `border-border/80` over `bg-background/95`; the dashboard opted out of it
 * entirely and built its own at `h-16` with `border-border/70` over
 * `bg-card/95`. Navigating between Dashboard and anything else moved the header
 * 12px and changed its colour — the single most obvious sign that the app had
 * been built in two sittings.
 *
 * The mobile menu button lives here rather than in each caller, because both
 * previous headers had rebuilt it and only one of them was reachable from the
 * dashboard.
 */
export function PageHeader({
  title,
  children,
  actions,
  actionsLabel = 'Page controls',
  className,
}: {
  /** The page name. Rendered as the page <h1>. */
  title: string;
  /** Contextual content beside the title — breadcrumbs, status. */
  children?: ReactNode;
  /** Right-aligned controls. */
  actions?: ReactNode;
  /**
   * Accessible name for the control group. Defaults to a generic label, but a
   * page with a distinct toolbar should say so — "Dashboard controls" tells a
   * screen-reader user considerably more than "Page controls".
   */
  actionsLabel?: string;
  className?: string;
}) {
  const openDrawer = useUIStore((s) => s.setMobileDrawerOpen);

  return (
    <header
      className={cn(
        /*
         * bg-card, not a translucent page background. The header sits above a
         * muted page and needs to read as a solid surface at the same
         * elevation as the panels below it; a backdrop-blurred translucent bar
         * over a dense grid shimmers while scrolling.
         */
        'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-card px-gutter md:px-5 xl:px-6',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1 shrink-0 lg:hidden"
        aria-label="Open navigation menu"
        onClick={() => openDrawer(true)}
      >
        <Menu aria-hidden />
      </Button>

      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate font-display text-page-title font-semibold text-foreground">
          {title}
        </h1>
        {children}
      </div>

      {actions ? (
        /*
         * Scrolls horizontally rather than wrapping. A header that grows to a
         * second row on a narrow viewport pushes the whole page down and makes
         * the sticky offset wrong for everything below it.
         */
        <div
          className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={actionsLabel}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}

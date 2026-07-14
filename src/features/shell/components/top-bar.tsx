'use client';

import { usePathname } from 'next/navigation';
import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui-store';
import { activeNavLabel } from '../nav';
import type { ShellUser } from '../types';
import { Breadcrumbs } from './breadcrumbs';
import { SearchTrigger } from './search-trigger';
import { NotificationCenter } from './notification-center';
import { ThemeSwitcher } from './theme-switcher';
import { UserMenu } from './user-menu';

/**
 * Workspace/context bar: menu (mobile), workspace title + L3 breadcrumbs, search
 * (opens palette), quick-actions placeholder, notifications, theme, user menu.
 */
export function TopBar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const openDrawer = useUIStore((s) => s.setMobileDrawerOpen);
  const openPalette = useUIStore((s) => s.setCommandPaletteOpen);
  const title = activeNavLabel(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation menu"
        onClick={() => openDrawer(true)}
      >
        <Menu aria-hidden />
      </Button>

      <div className="flex items-center gap-3">
        <span className="font-display text-base font-semibold tracking-tight">{title}</span>
        <Breadcrumbs />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="hidden md:block">
          <SearchTrigger />
        </div>
        {/* Quick-actions placeholder — opens the palette until actions are wired. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Quick actions"
          onClick={() => openPalette(true)}
        >
          <Plus aria-hidden />
        </Button>
        <NotificationCenter />
        <ThemeSwitcher />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore, hydrateUIStore } from '@/store/ui-store';
import type { ShellUser } from '../types';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { MobileTabBar, MobileDrawer } from './mobile-nav';
import { CommandPalette } from './command-palette';
import { useShellShortcuts } from '../hooks/use-shell-shortcuts';
import { useFocusOnRouteChange } from '../hooks/use-focus-on-route-change';

/**
 * The authenticated application shell: sidebar + top bar + content + mobile nav +
 * command palette. Future features mount into `children` and register nav/command
 * entries — the shell itself needs no change to accept them.
 */
export function DashboardShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const mode = useUIStore((s) => s.sidebarMode);

  useShellShortcuts();
  useFocusOnRouteChange();
  useEffect(() => {
    hydrateUIStore(); // rehydrate persisted shell prefs after mount
  }, []);

  // Content offset for the fixed sidebar (floating keeps the rail width).
  const padClass = mode === 'floating' || collapsed ? 'lg:pl-16' : 'lg:pl-64';

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileDrawer />

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-150', padClass)}>
        <TopBar user={user} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 pb-24 outline-none md:px-6 lg:pb-8"
        >
          <div className="mx-auto w-full max-w-6xl 2xl:max-w-[1600px]">{children}</div>
        </main>
      </div>

      <MobileTabBar />
      <CommandPalette />
    </div>
  );
}

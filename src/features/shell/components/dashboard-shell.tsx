'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  const tradingWorkspace = pathname === '/chart';

  useShellShortcuts();
  useFocusOnRouteChange();
  useEffect(() => {
    hydrateUIStore(); // rehydrate persisted shell prefs after mount
  }, []);

  // Content offset for the fixed sidebar (floating keeps the rail width).
  const padClass = tradingWorkspace
    ? 'pl-0'
    : mode === 'floating' || collapsed
      ? 'lg:pl-16'
      : 'lg:pl-64';

  return (
    <div className="min-h-screen bg-background">
      {!tradingWorkspace ? <Sidebar /> : null}
      <MobileDrawer />

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-150', padClass)}>
        {!tradingWorkspace ? <TopBar user={user} /> : null}
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'flex-1 outline-none',
            tradingWorkspace ? 'px-0 py-0' : 'px-4 py-6 pb-24 md:px-6 lg:pb-8',
          )}
        >
          <div
            className={cn(
              'w-full',
              tradingWorkspace ? 'max-w-none' : 'mx-auto max-w-6xl 2xl:max-w-[1600px]',
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {!tradingWorkspace ? <MobileTabBar /> : null}
      <CommandPalette />
    </div>
  );
}

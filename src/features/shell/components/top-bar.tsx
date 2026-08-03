'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { activeNavLabel } from '../nav';
import type { ShellUser } from '../types';
import { Breadcrumbs } from './breadcrumbs';
import { PageHeader } from './page-header';
import { SearchTrigger } from './search-trigger';
import { NotificationCenter } from './notification-center';
import { ThemeSwitcher } from './theme-switcher';
import { UserMenu } from './user-menu';

/**
 * Workspace/context bar: workspace title + L3 breadcrumbs, search (opens
 * palette), account creation, notifications, theme, and user menu.
 *
 * The bar itself is now PageHeader, shared with the dashboard. This used to be
 * a second, differently sized header — see page-header.tsx.
 */
export function TopBar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const title = activeNavLabel(pathname);

  return (
    <PageHeader
      title={title}
      actions={
        <>
          <div className="hidden md:block">
            <SearchTrigger />
          </div>
          <Button asChild variant="ghost" size="icon" aria-label="Add trading account">
            <Link href="/dashboard?addAccount=1">
              <Plus aria-hidden />
            </Link>
          </Button>
          <NotificationCenter />
          <ThemeSwitcher />
          <UserMenu user={user} />
        </>
      }
    >
      <Breadcrumbs />
    </PageHeader>
  );
}

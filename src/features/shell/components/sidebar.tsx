'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/store/ui-store';
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, isNavItemActive, type NavItem } from '../nav';
import type { ShellUser } from '../types';
import { UserMenu } from './user-menu';

const RAIL_WIDTH = 'w-[76px]';

function RailTooltip({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: ReactElement;
}) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, item.href);
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'premium-interactive relative flex h-11 w-full items-center rounded-md text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground motion-reduce:transition-none',
        collapsed ? 'justify-center px-0' : 'gap-3 px-3',
        active
          ? 'bg-background/15 text-background shadow-sm'
          : 'hover:bg-background/8 text-background/70 hover:text-background',
      )}
    >
      <item.icon className="size-[18px] shrink-0" aria-hidden />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {active ? (
        <span className="absolute left-0 h-5 w-0.5 rounded-r-full bg-primary" aria-hidden />
      ) : null}
    </Link>
  );

  return (
    <RailTooltip label={item.label} collapsed={collapsed}>
      {link}
    </RailTooltip>
  );
}

/** Desktop-only navigation rail. Mobile continues to use the existing drawer and tab bar. */
export function Sidebar({ user }: { user: ShellUser }) {
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggle = useUIStore((state) => state.toggleSidebar);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        aria-label="Desktop navigation"
        data-state={collapsed ? 'collapsed' : 'expanded'}
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-background/10 bg-foreground text-background shadow-[8px_0_24px_hsl(var(--foreground)/0.06)] transition-[width] duration-normal ease-standard motion-reduce:transition-none lg:flex',
          collapsed ? RAIL_WIDTH : 'w-[232px]',
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="absolute -right-4 top-[16px] z-10 size-8 rounded-full border-border bg-card text-card-foreground shadow-md transition duration-fast ease-standard hover:bg-accent motion-reduce:transition-none"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden />
          )}
        </Button>

        <div
          className={cn(
            'flex h-16 shrink-0 items-center overflow-hidden border-b border-background/10',
            collapsed ? 'justify-center px-0' : 'gap-2.5 px-5',
          )}
        >
          <span className="flex shrink-0 items-end gap-1" aria-hidden>
            <span className="h-2 w-5 translate-x-0.5 rounded-sm bg-primary" />
            <span className="h-2 w-5 rounded-sm bg-background" />
          </span>
          {!collapsed ? (
            <span className="truncate font-display text-base font-semibold tracking-tight">
              MetaTradee
            </span>
          ) : (
            <span className="sr-only">MetaTradee</span>
          )}
        </div>

        <div className="shrink-0 px-4 pb-2 pt-3">
          <RailTooltip label="Add account" collapsed={collapsed}>
            <Button
              asChild
              size="sm"
              className={cn(
                'h-11 overflow-hidden rounded-md bg-primary text-primary-foreground transition duration-fast ease-standard hover:bg-primary/90 motion-reduce:transition-none',
                collapsed ? 'w-11 justify-center px-0' : 'w-full justify-start gap-3 px-3',
              )}
            >
              <Link
                href="/dashboard?addAccount=1"
                aria-label={collapsed ? 'Add account' : undefined}
              >
                <Plus className="size-[18px] shrink-0" aria-hidden />
                {!collapsed ? <span>Add account</span> : null}
              </Link>
            </Button>
          </RailTooltip>
        </div>

        <nav aria-label="Primary" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-2.5">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.id} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="shrink-0 border-t border-background/10 px-4 py-3">
          <div className="space-y-1">
            {SECONDARY_NAV_ITEMS.map((item) => (
              <NavLink key={item.id} item={item} collapsed={collapsed} />
            ))}
          </div>

          <div
            className={cn(
              'mt-3 flex min-h-11 items-center border-t border-background/10 pt-3',
              collapsed ? 'justify-center' : 'gap-3',
            )}
          >
            <RailTooltip label="Account menu" collapsed={collapsed}>
              <div className="[&_button:hover]:bg-background/10 [&_button]:text-background">
                <UserMenu user={user} />
              </div>
            </RailTooltip>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-background">{user.displayName}</p>
                {user.email ? (
                  <p className="truncate text-[11px] text-background/55">{user.email}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

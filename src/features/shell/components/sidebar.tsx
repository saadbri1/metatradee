'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, Pin, PinOff, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui-store';
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, isNavItemActive, type NavItem } from '../nav';
import type { ShellUser } from '../types';
import { UserMenu } from './user-menu';

function NavLink({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={expanded ? undefined : item.label}
      className={cn(
        'flex min-h-10 items-center gap-3 overflow-hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none',
        active
          ? 'bg-[#6956c8] text-white shadow-[0_6px_18px_rgba(105,86,200,.28)]'
          : 'hover:bg-white/8 text-[#aaa4bc] hover:text-white',
      )}
    >
      <item.icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/**
 * Desktop sidebar (lg+). Supports collapsed icon-rail (pinned) and a
 * floating/overlay mode that expands on hover/focus. `<nav>` landmark, active
 * item via `aria-current`, keyboard-focusable links.
 */
export function Sidebar({ user }: { user: ShellUser }) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const mode = useUIStore((s) => s.sidebarMode);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const toggleMode = useUIStore((s) => s.toggleSidebarMode);

  const floating = mode === 'floating';
  // In floating mode the rail is narrow but expands on hover/focus (overlay).
  const widthClass = floating
    ? 'w-20 hover:w-64 focus-within:w-64 shadow-lg'
    : collapsed
      ? 'w-20'
      : 'w-64';
  // Whether labels are visible in the resting state (affects tooltips only).
  const expandedResting = !floating && !collapsed;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-white/5 bg-[#292337] text-white shadow-[12px_0_30px_rgba(32,25,48,.08)] transition-[width] duration-normal ease-standard motion-reduce:transition-none lg:flex',
        widthClass,
      )}
    >
      <div className="flex h-[76px] items-center gap-3 overflow-hidden px-5">
        <span className="flex shrink-0 items-end gap-1" aria-hidden>
          <span className="h-2 w-5 translate-x-0.5 rounded-sm bg-[#8c78ef]" />
          <span className="h-2 w-5 rounded-sm bg-white" />
        </span>
        <span className="truncate font-display text-sm font-semibold tracking-tight">
          MetaTradee
        </span>
      </div>

      <div className="px-4 pb-3">
        <Button
          asChild
          size="sm"
          className="h-10 w-full justify-start gap-3 overflow-hidden bg-[#6956c8] px-3 text-white hover:bg-[#7562d2]"
          title={expandedResting ? undefined : 'Add account'}
        >
          <Link href="/dashboard?addAccount=1">
            <Plus className="size-4 shrink-0" aria-hidden />
            <span>Add account</span>
          </Link>
        </Button>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.id} item={item} expanded={expandedResting} />
        ))}
      </nav>

      <div className="border-white/8 space-y-1 border-t px-4 py-3">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <NavLink key={item.id} item={item} expanded={expandedResting} />
        ))}
        <div className="flex items-center gap-1 pt-1 text-[#aaa4bc]">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className="hover:bg-white/8 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMode}
            aria-label={floating ? 'Pin sidebar' : 'Float sidebar'}
            aria-pressed={floating}
            className="hover:bg-white/8 hover:text-white"
          >
            {floating ? <Pin aria-hidden /> : <PinOff aria-hidden />}
          </Button>
          <div className="ml-auto">
            <UserMenu user={user} />
          </div>
        </div>
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui-store';
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, isNavItemActive, type NavItem } from '../nav';

function NavLink({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={expanded ? undefined : item.label}
      className={cn(
        'flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
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
export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const mode = useUIStore((s) => s.sidebarMode);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const toggleMode = useUIStore((s) => s.toggleSidebarMode);

  const floating = mode === 'floating';
  // In floating mode the rail is narrow but expands on hover/focus (overlay).
  const widthClass = floating
    ? 'w-16 hover:w-64 focus-within:w-64 shadow-lg'
    : collapsed
      ? 'w-16'
      : 'w-64';
  // Whether labels are visible in the resting state (affects tooltips only).
  const expandedResting = !floating && !collapsed;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150 lg:flex',
        widthClass,
      )}
    >
      <div className="flex h-14 items-center gap-2 overflow-hidden px-3">
        <span className="flex items-end gap-1" aria-hidden>
          <span className="h-2 w-6 translate-x-0.5 rounded-sm bg-primary" />
          <span className="h-2 w-6 rounded-sm bg-foreground" />
        </span>
        <span className="truncate font-display text-sm font-semibold">MetaTradee</span>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.id} item={item} expanded={expandedResting} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-border px-2 py-2">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <NavLink key={item.id} item={item} expanded={expandedResting} />
        ))}
        <div className="flex items-center gap-1 px-1 pt-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMode}
            aria-label={floating ? 'Pin sidebar' : 'Float sidebar'}
            aria-pressed={floating}
          >
            {floating ? <Pin aria-hidden /> : <PinOff aria-hidden />}
          </Button>
        </div>
      </div>
    </aside>
  );
}

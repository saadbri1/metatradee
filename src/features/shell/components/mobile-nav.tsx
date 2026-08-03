'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useUIStore } from '@/store/ui-store';
import { MOBILE_NAV_ITEMS, ALL_NAV_ITEMS, isNavItemActive, type NavItem } from '../nav';

/** Bottom tab bar (mobile only): 4 primary items + a center command action. */
export function MobileTabBar() {
  const pathname = usePathname();
  const setPalette = useUIStore((s) => s.setCommandPaletteOpen);
  const left = MOBILE_NAV_ITEMS.slice(0, 2);
  const right = MOBILE_NAV_ITEMS.slice(2, 4);

  const tab = (item: NavItem) => {
    const active = isNavItemActive(pathname, item.href);
    return (
      <Link
        key={item.id}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          // 44px min touch target, and the label never truncates mid-word.
          'relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-label normal-case tracking-normal',
          active ? 'font-semibold text-primary' : 'font-medium text-muted-foreground',
        )}
      >
        {/* Matches the rail's marker so "where am I" reads the same on both. */}
        {active ? (
          <span
            className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-primary"
            aria-hidden
          />
        ) : null}
        <item.icon className="size-5" aria-hidden />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {left.map(tab)}
      <button
        type="button"
        onClick={() => setPalette(true)}
        aria-label="Search — open command palette"
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-label font-medium normal-case tracking-normal text-muted-foreground"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Search className="size-5" aria-hidden />
        </span>
      </button>
      {right.map(tab)}
    </nav>
  );
}

/** Overflow drawer (all nav) — Radix Sheet gives focus trap, Esc, focus return. */
export function MobileDrawer({ lockedNav = [] }: { lockedNav?: readonly string[] }) {
  const pathname = usePathname();
  const open = useUIStore((s) => s.mobileDrawerOpen);
  const setOpen = useUIStore((s) => s.setMobileDrawerOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="All sections" className="mt-4 space-y-1">
          {ALL_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const locked = lockedNav.includes(item.id);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                aria-label={locked ? `${item.label} (upgrade required)` : undefined}
                className={cn(
                  // min-h-11 for touch; active gets weight as well as fill.
                  'relative flex min-h-11 items-center gap-3 rounded-md px-3 text-control',
                  active
                    ? 'bg-accent font-semibold text-accent-foreground'
                    : 'font-medium text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground',
                )}
              >
                {active ? (
                  <span
                    className="absolute left-0 h-5 w-[3px] rounded-r-full bg-primary"
                    aria-hidden
                  />
                ) : null}
                <item.icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
                {locked ? <Lock className="ml-auto size-3.5 shrink-0" aria-hidden /> : null}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

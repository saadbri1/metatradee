'use client';

/**
 * The public marketing header.
 *
 * Structure: substantial brand lockup left, primary navigation centred, Log in
 * + Get Started right — on a light, generously spaced bar roughly 104px tall.
 * It is the same component on every public page; there is no per-page header.
 *
 * ACCESSIBILITY
 * - The bar is a `<nav aria-label="Primary">` inside a `<header>`.
 * - Each dropdown trigger is a real button carrying `aria-expanded` and
 *   `aria-controls`; the panel it owns is labelled by that trigger.
 * - Escape closes and returns focus to the trigger; a pointer-down outside
 *   closes; Tab out of the panel closes it.
 * - `aria-current="page"` marks the active route.
 * - All motion is transform/opacity only and is disabled under
 *   `prefers-reduced-motion`.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import { BrandLockup } from './brand-mark';
import { MobileNavDrawer } from './mobile-nav-drawer';
import { NAV_LINKS, NAV_MENUS, type NavMenu } from '../navigation';

/** True when `href` addresses the page currently rendered. */
function useIsCurrent() {
  const pathname = usePathname();
  return useCallback(
    (href: string) => {
      const path = href.split('#')[0] || '/';
      return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
    },
    [pathname],
  );
}

function MenuPanel({
  menu,
  panelId,
  onNavigate,
}: {
  menu: NavMenu;
  panelId: string;
  onNavigate: () => void;
}) {
  return (
    <div
      id={panelId}
      className={cn(
        'marketing-menu absolute left-1/2 top-[calc(100%-0.5rem)] z-50 -translate-x-1/2',
        'rounded-2xl border border-border/80 bg-popover p-3 shadow-[0_28px_70px_-30px_hsl(var(--foreground)/0.42)]',
        menu.columns === 2 ? 'w-[41rem]' : 'w-[24rem]',
      )}
    >
      <ul className={cn('grid gap-1', menu.columns === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
        {menu.items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Icon ? (
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <Icon className="size-[1.125rem]" aria-hidden />
                  </span>
                ) : null}
                <span className="min-w-0">
                  <span className="block text-[0.9375rem] font-semibold text-foreground">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[0.8125rem] leading-5 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 border-t border-border/70 px-3 pb-1 pt-3">
        <Link
          href={menu.href}
          onClick={onNavigate}
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          All {menu.label} →
        </Link>
      </div>
    </div>
  );
}

export function MarketingHeader() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuBaseId = useId();
  const isCurrent = useIsCurrent();

  const close = useCallback((restoreFocus = false) => {
    setOpenMenu((current) => {
      if (current && restoreFocus) triggerRefs.current[current]?.focus();
      return null;
    });
  }, []);

  // Escape closes and hands focus back to the trigger that opened the panel.
  useEffect(() => {
    if (!openMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openMenu, close]);

  // A pointer press anywhere outside the nav closes the open panel.
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openMenu, close]);

  // Tabbing past the last item in a panel closes it rather than leaving an
  // orphaned menu open behind the user.
  useEffect(() => {
    if (!openMenu) return;
    const onFocusIn = (event: FocusEvent) => {
      if (!navRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [openMenu, close]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 border-b bg-background/95 backdrop-blur-xl',
          'transition-[border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none',
          scrolled
            ? 'border-border shadow-[0_10px_30px_-24px_hsl(var(--foreground)/0.5)]'
            : 'border-border/70',
        )}
      >
        <div className="relative mx-auto flex h-[6.5rem] w-full max-w-[1480px] items-center gap-8 px-6 sm:px-10 lg:px-14">
          {/* Brand */}
          <Link
            href="/"
            aria-label={`${siteConfig.name} home`}
            className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <BrandLockup size={44} />
          </Link>

          {/* Primary navigation — centred between brand and actions */}
          {/* Absolutely centred so the navigation sits on the page axis rather
            than being pushed off-centre by the brand and action widths. */}
          <nav
            ref={navRef}
            aria-label="Primary"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center xl:flex"
          >
            <ul className="flex items-center gap-2">
              {NAV_MENUS.slice(0, 2).map((menu) => (
                <MenuTrigger
                  key={menu.label}
                  menu={menu}
                  panelId={`${menuBaseId}-${menu.label}`}
                  open={openMenu === menu.label}
                  current={isCurrent(menu.href)}
                  onToggle={() => setOpenMenu((v) => (v === menu.label ? null : menu.label))}
                  onClose={close}
                  registerRef={(el) => (triggerRefs.current[menu.label] = el)}
                />
              ))}

              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isCurrent(link.href) ? 'page' : undefined}
                    onClick={() => close()}
                    className={cn(
                      'inline-flex h-11 items-center rounded-lg px-4 text-[1.0625rem] font-medium transition-colors',
                      'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isCurrent(link.href)
                        ? 'text-primary'
                        : 'text-foreground/85 hover:text-foreground',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}

              {NAV_MENUS.slice(2).map((menu) => (
                <MenuTrigger
                  key={menu.label}
                  menu={menu}
                  panelId={`${menuBaseId}-${menu.label}`}
                  open={openMenu === menu.label}
                  current={isCurrent(menu.href)}
                  onToggle={() => setOpenMenu((v) => (v === menu.label ? null : menu.label))}
                  onClose={close}
                  registerRef={(el) => (triggerRefs.current[menu.label] = el)}
                />
              ))}
            </ul>
          </nav>

          {/* Actions */}
          {/* `ml-auto` always applies: the centred nav is absolutely positioned
            and out of flow, so it cannot push the actions to the right. */}
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link
              href="/login"
              className="hidden h-12 items-center rounded-lg px-5 text-[1.0625rem] font-medium text-foreground/85 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className={cn(
                // Hidden on the narrowest screens: the brand, a full-size CTA
                // and the menu button cannot share 375px without overflowing.
                // Log in and Get Started both sit in the drawer's sticky footer
                // there, so neither becomes unreachable.
                'hidden h-14 items-center gap-2 rounded-xl px-8 text-[1.0625rem] font-semibold sm:inline-flex',
                'bg-gradient-to-r from-primary to-iris text-primary-foreground',
                'shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.85)]',
                'transition-[transform,box-shadow] duration-200 ease-out',
                'hover:-translate-y-px hover:shadow-[0_16px_34px_-14px_hsl(var(--primary)/0.95)]',
                'active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
            >
              Get Started
            </Link>

            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="inline-flex size-12 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
            >
              <Menu className="size-6" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {/*
        The drawer is a SIBLING of <header>, never a child. The header applies
        `backdrop-filter`, which establishes a containing block for fixed
        descendants — nesting the drawer inside it would position the overlay
        against the header instead of the viewport.
      */}
      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function MenuTrigger({
  menu,
  panelId,
  open,
  current,
  onToggle,
  onClose,
  registerRef,
}: {
  menu: NavMenu;
  panelId: string;
  open: boolean;
  current: boolean;
  onToggle: () => void;
  onClose: () => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <li className="relative">
      <button
        type="button"
        ref={registerRef}
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={current ? 'page' : undefined}
        onClick={onToggle}
        className={cn(
          'inline-flex h-11 items-center gap-1.5 rounded-lg px-4 text-[1.0625rem] font-medium transition-colors',
          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open || current ? 'text-primary' : 'text-foreground/85 hover:text-foreground',
        )}
      >
        {menu.label}
        <ChevronDown
          className={cn(
            'size-4 transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? <MenuPanel menu={menu} panelId={panelId} onNavigate={onClose} /> : null}
    </li>
  );
}

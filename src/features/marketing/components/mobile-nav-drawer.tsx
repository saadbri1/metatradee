'use client';

/**
 * Mobile / tablet navigation drawer.
 *
 * Carries the SAME routes as the desktop bar (both read `navigation.ts`), so
 * the two can never drift. Dropdown menus become collapsible sections rather
 * than being dropped on small screens.
 *
 * ACCESSIBILITY
 * - `role="dialog" aria-modal="true"` with an accessible name.
 * - Focus moves into the drawer on open and is TRAPPED inside while it is open.
 * - Escape closes; on close focus returns to the button that opened it.
 * - Background scroll is locked so the page cannot move underneath.
 * - Sections are real disclosure buttons with `aria-expanded`/`aria-controls`.
 */
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import { BrandLockup } from './brand-mark';
import { NAV_LINKS, NAV_MENUS } from '../navigation';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sectionBaseId = useId();

  // Remember the opener, move focus in, and restore it on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => previouslyFocused.current?.focus();
  }, [open]);

  // Lock background scroll while the drawer owns the screen.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape to close; Tab cycles within the drawer (focus trap).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] xl:hidden">
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/40 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${siteConfig.name} navigation`}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-background shadow-2xl"
      >
        <div className="flex h-[6.5rem] shrink-0 items-center justify-between border-b border-border/70 px-6">
          <BrandLockup size={40} compact />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>

        <nav aria-label="Mobile" className="flex-1 px-4 py-5">
          <ul className="flex flex-col gap-1">
            {NAV_MENUS.map((menu) => {
              const sectionId = `${sectionBaseId}-${menu.label}`;
              const isOpen = expanded === menu.label;
              return (
                <li key={menu.label}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={sectionId}
                    onClick={() => setExpanded(isOpen ? null : menu.label)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3.5 text-left text-lg font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {menu.label}
                    <ChevronDown
                      className={cn(
                        'size-5 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
                        isOpen && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                  {isOpen ? (
                    <ul id={sectionId} className="mb-2 ml-3 border-l border-border pl-3">
                      {menu.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className="block rounded-lg px-3 py-2.5 text-[0.9375rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                      <li>
                        <Link
                          href={menu.href}
                          onClick={onClose}
                          className="block rounded-lg px-3 py-2.5 text-[0.9375rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          All {menu.label} →
                        </Link>
                      </li>
                    </ul>
                  ) : null}
                </li>
              );
            })}

            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block rounded-lg px-3 py-3.5 text-lg font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sticky bottom-0 grid shrink-0 gap-3 border-t border-border/70 bg-background px-6 py-5">
          <Link
            href="/login"
            onClick={onClose}
            className="h-13 inline-flex items-center justify-center rounded-xl border border-border px-6 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Log in
          </Link>
          <Link
            href="/register"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-iris px-6 py-4 text-base font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}

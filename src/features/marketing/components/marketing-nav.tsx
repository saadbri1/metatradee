'use client';

/**
 * Sticky marketing nav. Client only for the scroll-elevation state and the
 * mobile disclosure menu (keyboard-accessible, Esc-to-close, focus-visible).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { Wordmark } from './wordmark';

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      className={`marketing-nav-enter sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-normal ease-out motion-reduce:transition-none ${
        scrolled
          ? 'border-border/70 bg-background/80 shadow-[0_12px_32px_-24px_hsl(var(--foreground)/0.45)] backdrop-blur-xl'
          : 'border-transparent bg-transparent'
      }`}
    >
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`${siteConfig.name} home`}
        >
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Button key={l.href} asChild variant="ghost" size="sm">
              <Link href={l.href}>{l.label}</Link>
            </Button>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Get started</Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          className="motion-content-enter origin-top border-t border-border/70 bg-background/95 px-4 py-3 shadow-xl backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Button
                key={l.href}
                asChild
                variant="ghost"
                className="justify-start"
                onClick={() => setOpen(false)}
              >
                <Link href={l.href}>{l.label}</Link>
              </Button>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" onClick={() => setOpen(false)}>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild onClick={() => setOpen(false)}>
                <Link href="/register">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

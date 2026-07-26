import type { ReactNode } from 'react';
import { MarketingHeader } from './marketing-header';
import { MarketingFooter } from './footer';
import { RevealObserver } from '../motion/reveal-observer';

/**
 * The shared chrome for every public marketing page.
 *
 * One header, one footer, one skip link — Home, Products, Solutions, Supported
 * Brokers, Pricing and Resources all render through this, so there is no
 * per-page header to drift.
 *
 * APPEARANCE: the public site is presented in the light identity shown in the
 * brand reference. The `light` class re-scopes the design tokens for this
 * subtree only. Public routes expose no appearance control (the Light/Dark/
 * System switcher lives in the authenticated user menu), so this is the public
 * site's single designed presentation rather than an override of a user choice
 * — and the authenticated app's own theming is untouched by it.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="light flex min-h-screen flex-col bg-background text-foreground">
      <RevealObserver />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}

/** Standard hero band for the standalone public pages. */
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border/70 bg-gradient-to-b from-accent/45 to-background">
      <div className="mx-auto max-w-[1480px] px-6 py-20 sm:px-10 lg:px-14 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{lede}</p>
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}

/** Consistent content band used by every standalone public page. */
export function PageSection({
  id,
  title,
  lede,
  children,
}: {
  id?: string;
  title?: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 border-b border-border/60 last:border-0">
      <div className="mx-auto max-w-[1480px] px-6 py-16 sm:px-10 lg:px-14">
        {title ? (
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
        ) : null}
        {lede ? (
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">{lede}</p>
        ) : null}
        <div className={title || lede ? 'mt-10' : ''}>{children}</div>
      </div>
    </section>
  );
}

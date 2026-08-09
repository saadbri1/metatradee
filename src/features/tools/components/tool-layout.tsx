import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { PublicShell } from '@/features/marketing/components/public-shell';
import { SignupCta } from '@/lib/analytics/signup-cta';
import { RelatedLink } from '@/lib/analytics/related-link';
import { TrackOnMount } from '@/lib/analytics/track-on-mount';
import type { CalculatorId, RelatedDestination } from '@/lib/analytics/events';
import { Breadcrumbs } from '@/features/marketing/components/breadcrumbs';
import { serializeJsonLd } from '@/features/marketing/seo';
import { absoluteUrl, seoPage, type SeoPath } from '@/config/seo';
import { siteConfig } from '@/config/site';

/**
 * The shared frame for a free calculator page.
 *
 * WHAT IS SERVER-RENDERED AND WHY. Everything except the form itself: the H1,
 * the explanation, the formula, the worked example, the assumptions, the
 * internal links and the JSON-LD. A crawler and a reader with no JavaScript
 * both get the entire page; the client bundle is one form. That is the whole
 * argument for these pages ranking — they are documents that happen to compute,
 * not an application that happens to have text.
 *
 * THE RESULT IS NEVER GATED. No email wall, no signup before the number. The
 * account CTA sits AFTER the answer, because the trade this page makes is
 * "useful thing first, relationship second".
 *
 * `WebApplication` rather than `SoftwareApplication` here: the thing on this
 * page is a browser tool, and `offers: price 0` is a true statement about it.
 * No ratings, no review counts — nothing that is not on the page.
 */
export interface RelatedItem {
  href: string;
  label: string;
  description: string;
  /** What KIND of page this points at. Drives `calculator_related_click`. */
  destinationType: RelatedDestination;
}

export function ToolLayout({
  path,
  eyebrow,
  title,
  lede,
  calculator,
  calculatorId,
  children,
  related,
}: {
  path: SeoPath;
  eyebrow: string;
  /** The visible H1. Kept separate from the `<title>` so each can be tuned. */
  title: string;
  lede: string;
  calculator: ReactNode;
  /** Which calculator this page hosts, for the funnel events. */
  calculatorId: CalculatorId;
  /** Server-rendered explanatory sections. */
  children: ReactNode;
  related: RelatedItem[];
}) {
  const page = seoPage(path);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: title,
    url: absoluteUrl(path),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    description: page?.description ?? lede,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
  };

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      {/* Step one of the organic tool funnel. A leaf, so the page stays static. */}
      <TrackOnMount event="calculator_viewed" props={{ calculator: calculatorId }} />

      <section className="border-b border-border/70 bg-gradient-to-b from-accent/45 to-background">
        <div className="mx-auto max-w-[1480px] px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
          <Breadcrumbs path={path} />
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{lede}</p>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="mx-auto grid max-w-[1480px] gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-14">
          <div className="min-w-0">{calculator}</div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">Keep the answer</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This calculator sizes one trade. {siteConfig.name} records the trades you actually
                took and works out whether the sizing held up across all of them.
              </p>
              <SignupCta
                pageGroup="tool"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                Start free — no card
                <ArrowRight className="size-4" aria-hidden />
              </SignupCta>
              <Link
                href="/pricing"
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-medium transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                See pricing
              </Link>
            </div>

            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
              <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  Educational tool, not financial advice. Trading carries risk of loss. Confirm
                  contract sizes with your own broker before sizing a live position.
                </span>
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-3xl px-6 py-14 sm:px-10 lg:px-14">
          <div className="space-y-10 text-base leading-7 text-foreground">{children}</div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1480px] px-6 py-14 sm:px-10 lg:px-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Related</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.href}>
                <RelatedLink
                  calculator={calculatorId}
                  destinationType={item.destinationType}
                  href={item.href}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors duration-fast hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </span>
                </RelatedLink>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PublicShell>
  );
}

/** Section heading + prose, so every tool page has the same rhythm. */
export function ToolSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

/** A displayed formula. Monospace, and readable as text by a crawler. */
export function Formula({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 font-mono text-sm leading-6 text-foreground">
      {children}
    </pre>
  );
}

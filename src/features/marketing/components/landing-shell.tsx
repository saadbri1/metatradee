import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Check } from 'lucide-react';
import { PublicShell } from './public-shell';
import { Breadcrumbs } from './breadcrumbs';
import { serializeJsonLd } from '../seo';
import type { SeoPath } from '@/config/seo';
import { siteConfig } from '@/config/site';

/**
 * The shared frame for an acquisition landing page.
 *
 * WHY THESE PAGES EXIST AT ALL: each one owns a single non-brand commercial
 * intent that the flat marketing site had nowhere to answer. The registry's
 * `cluster` uniqueness test is what stops a second page ever competing for the
 * same intent — the cannibalisation problem is solved by the build, not by
 * remembering.
 *
 * EVERYTHING HERE IS SERVER-RENDERED. No client island at all: a crawler and a
 * reader with JavaScript disabled both get the whole document, and these pages
 * stay statically prerendered.
 *
 * THE FAQ IS GENERATED FROM THE SAME ARRAY AS THE `FAQPage` MARKUP, so the
 * structured data cannot describe questions the page does not show — the exact
 * mismatch that earns a manual action.
 */
export interface Faq {
  q: string;
  a: string;
}

export interface LandingLink {
  href: string;
  label: string;
  description: string;
}

/** A real screenshot from /public. Omitted entirely when none exists. */
export interface LandingScreenshot {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
}

export function LandingShell({
  path,
  eyebrow,
  title,
  lede,
  screenshot,
  children,
  faqs,
  related,
  ctaLabel = 'Start free — no card',
}: {
  path: SeoPath;
  eyebrow: string;
  title: string;
  lede: string;
  screenshot?: LandingScreenshot;
  children: ReactNode;
  faqs: Faq[];
  related: LandingLink[];
  ctaLabel?: string;
}) {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }}
      />

      <section className="border-b border-border/70 bg-gradient-to-b from-accent/45 to-background">
        <div className="mx-auto max-w-[1480px] px-6 py-14 sm:px-10 lg:px-14 lg:py-20">
          <Breadcrumbs path={path} />
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{lede}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors duration-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              {ctaLabel}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-6 text-sm font-semibold transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              See plans and limits
            </Link>
          </div>
        </div>
      </section>

      {screenshot ? (
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-[1480px] px-6 py-12 sm:px-10 lg:px-14">
            <figure className="overflow-hidden rounded-2xl border border-border bg-card">
              {/*
               * A real screenshot of the real product, sized so it reserves its
               * space and shifts nothing. Pages with no genuine asset show no
               * image rather than a mock-up dressed as one.
               */}
              <Image
                src={screenshot.src}
                alt={screenshot.alt}
                width={screenshot.width}
                height={screenshot.height}
                className="h-auto w-full"
                sizes="(min-width: 1024px) 1024px, 100vw"
              />
              <figcaption className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
                {screenshot.caption}
              </figcaption>
            </figure>
          </div>
        </section>
      ) : null}

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-3xl px-6 py-14 sm:px-10 lg:px-14">
          <div className="space-y-10 text-base leading-7 text-foreground">{children}</div>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-3xl px-6 py-14 sm:px-10 lg:px-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <dl className="mt-8 space-y-6">
            {faqs.map((f) => (
              <div key={f.q} className="border-b border-border/60 pb-6 last:border-0">
                <dt className="font-display text-base font-semibold text-foreground">{f.q}</dt>
                <dd className="mt-2 leading-7 text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1480px] px-6 py-14 sm:px-10 lg:px-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Keep reading</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors duration-fast hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/*
           * A closing CTA, not a block of restated metadata. An earlier draft
           * printed the meta description and the canonical URL here as visible
           * text — which is padding aimed at a crawler, reads as spam to a
           * person, and is exactly the thin-SEO habit these pages exist to
           * avoid.
           */}
          <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.9375rem] leading-6 text-muted-foreground">
              Free plan, no credit card, no expiry. Paid plans never auto-renew.
            </p>
            <Link
              href="/register"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors duration-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              Create a free {siteConfig.name} account
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

/** Section heading + prose, so every landing page keeps one rhythm. */
export function LandingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

/** A checked list. Used for "what this includes" — never for aspirations. */
export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[0.9375rem] leading-6">
          <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

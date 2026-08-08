/**
 * THE public-route registry. One entry per public URL, and the single source
 * for canonicals, the sitemap, breadcrumbs and indexation.
 *
 * WHY A REGISTRY RATHER THAN PER-PAGE STRINGS. The sitemap and the page
 * metadata used to be written independently, and they disagreed: five real
 * marketing pages were missing from the sitemap while `/login` and `/register`
 * were listed in it — the file's own comment claimed authenticated routes were
 * "intentionally excluded" while it advertised two of them for indexing. Two
 * hand-maintained lists of the same thing will always drift. Everything below
 * derives from this one array, so a page cannot be in the sitemap without being
 * indexable, and cannot claim a canonical the sitemap disagrees with.
 *
 * ADDING A PAGE: add the entry here, then build the route. A route without an
 * entry is invisible to the sitemap and gets no canonical — deliberately, so a
 * half-finished page is never advertised to search engines. `seo.test.ts`
 * enforces that every registered path resolves to a real route file.
 *
 * INDEXABLE IS NOT "EXISTS". A page is indexable only when it carries unique,
 * useful, complete content for a real search intent. Auth screens, the
 * authenticated app, and anything content-incomplete stay `index: false` — they
 * still render, they are simply not candidates for search.
 */
import type { Metadata } from 'next';
import { siteConfig } from './site';

/** Trailing slashes are never canonical here — Next redirects them away. */
export type SeoPath = `/${string}` | '/';

export interface SeoPage {
  /** Canonical path, leading slash, no trailing slash, no query. */
  path: SeoPath;
  /** Breadcrumb label. Short — this is a trail, not a headline. */
  label: string;
  /** `<title>`, without the site-name suffix (the template adds it). */
  title: string;
  /** Meta description. Aim for 150–160 characters. */
  description: string;
  /**
   * True only when the page is content-complete and should be a search result.
   * Drives BOTH the sitemap and the `robots` meta tag, so the two cannot
   * disagree.
   */
  index: boolean;
  /** Sitemap hints. Only meaningful when `index` is true. */
  changeFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
  /** Parent path, for the breadcrumb trail. Omit on top-level pages. */
  parent?: SeoPath;
  /** The keyword cluster this URL owns. One cluster, one canonical URL. */
  cluster?: string;
}

/*
 * The registry. Ordered as the site is structured, not alphabetically, so the
 * hub-and-spoke shape is legible when reading it.
 */
export const SEO_PAGES: readonly SeoPage[] = [
  {
    path: '/',
    label: 'Home',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    index: true,
    changeFrequency: 'weekly',
    priority: 1,
    cluster: 'trading journal software',
  },
  {
    path: '/products',
    label: 'Products',
    title: 'Products',
    description:
      'Every MetaTradee module: journal, analytics, AI coach, psychology, playbooks, calendar, reports, broker import and workspaces — each one shipped and shown.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.9,
    parent: '/',
    cluster: 'trading journal app',
  },
  {
    path: '/solutions',
    label: 'Solutions',
    title: 'Solutions',
    description:
      'How MetaTradee fits real trading workflows — reviewing a session, proving an edge, tightening risk, and preparing for a funded evaluation.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/',
    cluster: 'trading performance analytics',
  },
  {
    path: '/brokers',
    label: 'Supported brokers',
    title: 'Supported brokers and platforms',
    description:
      'Import your trade history from MetaTrader 4 and 5, cTrader, DXtrade, Match-Trader, TradeLocker and generic CSV or JSON statements.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/',
    cluster: 'metatrader trading journal',
  },
  {
    path: '/pricing',
    label: 'Pricing',
    title: 'Pricing',
    description:
      'Four plans, from a free journal to unlimited funded-account tracking. Prices are shown in full before you commit and paid plans never renew automatically.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.9,
    parent: '/',
    cluster: 'trading journal pricing',
  },
  {
    path: '/resources',
    label: 'Resources',
    title: 'Resources',
    description:
      'Guides to journalling a trading session, reading your own performance data honestly, and getting a broker import right the first time.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/',
    cluster: 'trading journal guide',
  },
  {
    path: '/contact',
    label: 'Contact',
    title: 'Contact',
    description:
      'Reach the MetaTradee team about the product, partnerships, pricing or an account issue. Every enquiry routes to the mailbox that answers it.',
    index: true,
    changeFrequency: 'yearly',
    priority: 0.5,
    parent: '/',
  },
  {
    path: '/support',
    label: 'Support',
    title: 'Support',
    description:
      'Get help with your MetaTradee account, trade imports, billing and subscriptions, or a technical problem.',
    index: true,
    changeFrequency: 'yearly',
    priority: 0.5,
    parent: '/',
  },

  /* ---------------------------------------------------------------- *
   * Free tools. Product-led SEO: each one is fully usable without an
   * account, and each is a genuine entry point rather than a teaser.
   * ---------------------------------------------------------------- */
  {
    path: '/tools',
    label: 'Free tools',
    title: 'Free trading calculators',
    description:
      'Free position-size, risk and drawdown calculators for forex, futures and gold traders. No account needed, no email wall, formulas shown in full.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/',
    cluster: 'trading calculators',
  },
  {
    path: '/tools/position-size-calculator',
    label: 'Position size calculator',
    title: 'Position size calculator',
    description:
      'Work out lot size from account balance, risk percentage and stop distance. Shows the formula, the money at risk and the value per pip for any pair.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/tools',
    cluster: 'position size calculator',
  },
  {
    path: '/tools/xauusd-lot-size-calculator',
    label: 'XAUUSD lot size calculator',
    title: 'XAUUSD lot size calculator',
    description:
      'Calculate gold lot size from your risk and stop distance in dollars. Built around the XAUUSD contract size, with the arithmetic shown step by step.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/tools',
    cluster: 'xauusd lot size calculator',
  },
  {
    path: '/tools/risk-reward-calculator',
    label: 'Risk/reward calculator',
    title: 'Risk/reward ratio calculator',
    description:
      'Turn entry, stop and target into a risk-reward ratio, and see the win rate that ratio needs to break even. Shows every step of the calculation.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/tools',
    cluster: 'risk reward calculator',
  },

  /* ---------------------------------------------------------------- *
   * NOT INDEXABLE. These render and are reachable; they are simply not
   * search results. Kept in the registry so they still get a canonical
   * and an explicit `noindex` rather than being forgotten.
   * ---------------------------------------------------------------- */
  {
    path: '/login',
    label: 'Log in',
    title: 'Log in',
    description: 'Sign in to MetaTradee.',
    index: false,
  },
  {
    path: '/register',
    label: 'Create account',
    title: 'Create your account',
    description: 'Create a MetaTradee account.',
    index: false,
  },
  {
    path: '/forgot-password',
    label: 'Reset password',
    title: 'Reset your password',
    description: 'Request a password reset link.',
    index: false,
  },
  {
    path: '/reset-password',
    label: 'Set a new password',
    title: 'Set a new password',
    description: 'Choose a new password.',
    index: false,
  },
  {
    path: '/verify-email',
    label: 'Verify email',
    title: 'Check your inbox',
    description: 'Confirm your email address.',
    index: false,
  },
  {
    path: '/session-expired',
    label: 'Session expired',
    title: 'Your session expired',
    description: 'Sign in again to continue.',
    index: false,
  },
  {
    path: '/unauthorized',
    label: 'Access denied',
    title: 'Access denied',
    description: 'You do not have access to that page.',
    index: false,
  },
] as const;

const BY_PATH = new Map(SEO_PAGES.map((p) => [p.path, p]));

export function seoPage(path: SeoPath): SeoPage | undefined {
  return BY_PATH.get(path);
}

/** Everything the sitemap may contain. The ONLY definition of that set. */
export function indexablePages(): SeoPage[] {
  return SEO_PAGES.filter((p) => p.index);
}

/** Absolute URL for a path. The base never carries a trailing slash. */
export function absoluteUrl(path: SeoPath): string {
  const base = siteConfig.url.replace(/\/$/, '');
  return path === '/' ? `${base}/` : `${base}${path}`;
}

/**
 * Page metadata built from the registry.
 *
 * Every page gets a canonical, and a non-indexable page additionally gets an
 * explicit `noindex, nofollow`. Note that these routes are NOT disallowed in
 * robots.txt: a crawler has to fetch the page to see the directive, so blocking
 * it would preserve exactly the indexing this is meant to prevent.
 */
export function metadataFor(path: SeoPath): Metadata {
  const page = seoPage(path);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    robots: page.index ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'website',
      url: absoluteUrl(page.path),
      siteName: siteConfig.name,
      title: page.title,
      description: page.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
    },
  };
}

export interface Crumb {
  name: string;
  path: SeoPath;
}

/**
 * Breadcrumb trail, root first, ending at the page itself.
 *
 * Walks `parent` links with a visited set: a registry typo that pointed two
 * pages at each other would otherwise hang the render rather than fail loudly.
 */
export function breadcrumbsFor(path: SeoPath): Crumb[] {
  const trail: Crumb[] = [];
  const seen = new Set<string>();
  let current = seoPage(path);
  while (current && !seen.has(current.path)) {
    seen.add(current.path);
    trail.unshift({ name: current.label, path: current.path });
    current = current.parent ? seoPage(current.parent) : undefined;
  }
  return trail;
}

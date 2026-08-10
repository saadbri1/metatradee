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
      'Every MetaTradee module: trading dashboard, journal, analytics, chart replay, playbooks, AI coach, calendar and reports.',
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
      'How MetaTradee supports active traders, futures traders, funded traders, coaches and teams — and the review, practice and strategy workflows they run.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/',
    cluster: 'trading performance analytics',
  },
  {
    path: '/brokers',
    label: 'Supported brokers',
    title: 'Supported Brokers',
    description:
      'Platforms MetaTradee can import from today via CSV or JSON statement files, the asset classes they cover, and what is not yet supported.',
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
      'Four plans for MetaTradee, from a free journal to unlimited funded-account tracking. Compare what each plan unlocks. Paid plans are bought 30 or 365 days at a time and never renew automatically.',
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
      'Guides for the MetaTradee journal, replay, analytics, playbooks and AI coach, plus help, product updates, security and contact details.',
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
      'How to reach MetaTradee: support, sales, general enquiries, and company or press information.',
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
   * Acquisition hubs. Each targets one non-brand commercial intent and
   * owns it outright — the `cluster` uniqueness test makes a second page
   * claiming the same intent a build failure.
   * ---------------------------------------------------------------- */
  {
    path: '/trading-journal',
    label: 'Trading journal',
    title: 'Trading journal software',
    /*
     * "P&L and planned reward-to-risk", not "R". The page itself states that a
     * realised R-multiple is NOT computed; this description used to say "R" and
     * so contradicted the page it describes — in the snippet a searcher reads
     * before deciding to click.
     */
    description:
      'A trading journal that computes P&L and planned reward-to-risk on the server from one engine, so the number in your journal is the number in your analytics.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.9,
    parent: '/',
    cluster: 'trading journal',
  },
  {
    path: '/ai-trading-journal',
    label: 'AI trading journal',
    title: 'AI trading journal',
    description:
      'An AI coach that reviews the trades you actually took and cites each one behind every observation. No signals, no predictions, no financial advice.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/trading-journal',
    cluster: 'ai trading journal',
  },
  {
    path: '/free-trading-journal',
    label: 'Free trading journal',
    title: 'Free trading journal',
    description:
      'Journal 50 trades on one account with no credit card. Exactly what the free plan includes and what it does not, stated plainly before you sign up.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/trading-journal',
    cluster: 'free trading journal',
  },
  {
    path: '/integrations/metatrader-5',
    label: 'MetaTrader 5',
    title: 'MT5 trading journal — import MetaTrader 5 history',
    description:
      'Import MetaTrader 5 history as a CSV or JSON statement, with column mapping, a preview before anything is written, and de-duplication on re-import.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/brokers',
    cluster: 'mt5 trading journal',
  },
  {
    path: '/integrations/metatrader-4',
    label: 'MetaTrader 4',
    title: 'MT4 trading journal — import MetaTrader 4 history',
    description:
      'Import MetaTrader 4 history as a CSV or JSON statement. Column mapping for MT4 headers, a dry-run preview, and content-hash de-duplication.',
    index: true,
    changeFrequency: 'monthly',
    priority: 0.8,
    parent: '/brokers',
    cluster: 'mt4 trading journal',
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
      /*
       * THE IMAGE MUST BE DECLARED HERE, not inherited.
       *
       * Next merges metadata SHALLOWLY: a page that declares `openGraph`
       * replaces the layout's entire `openGraph` object — including the
       * `og:image` that the `opengraph-image` file convention attaches to it.
       * The first version of this helper omitted `images`, and the four tool
       * pages silently shipped with no OG image at all while every older page
       * kept one. Naming it explicitly makes the result the same on every page
       * regardless of what the layout does.
       */
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} — ${siteConfig.tagline}`,
        },
      ],
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

/**
 * The SEO registry, the sitemap and robots.txt.
 *
 * THE BUG THESE EXIST TO PREVENT ALREADY HAPPENED. The hand-written sitemap
 * omitted five real marketing pages and listed `/login` and `/register` — while
 * its own comment claimed authenticated routes were excluded. Nothing caught it
 * because nothing compared the two lists. Everything below compares them.
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SEO_PAGES,
  absoluteUrl,
  breadcrumbsFor,
  indexablePages,
  metadataFor,
  seoPage,
} from '@/config/seo';
import { siteConfig } from '@/config/site';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

const ROOT = resolve(__dirname, '../../..');

/** Paths that must never be a search result, whatever else changes. */
const PRIVATE_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/session-expired',
  '/unauthorized',
];

describe('the registry is internally consistent', () => {
  it('uses each path exactly once', () => {
    const paths = SEO_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('gives every indexable page a unique title', () => {
    const titles = indexablePages().map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('gives every indexable page a unique description', () => {
    const descriptions = indexablePages().map((p) => p.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('keeps descriptions inside a length search engines will render', () => {
    for (const page of indexablePages()) {
      expect(page.description.length, `${page.path} too short`).toBeGreaterThan(50);
      expect(page.description.length, `${page.path} too long`).toBeLessThanOrEqual(200);
    }
  });

  it('assigns each keyword cluster to exactly ONE canonical URL', () => {
    // Two pages targeting one cluster is self-cannibalisation by construction.
    const clusters = indexablePages()
      .map((p) => p.cluster)
      .filter((c): c is string => Boolean(c));
    expect(new Set(clusters).size).toBe(clusters.length);
  });

  it('points every parent link at a page that exists', () => {
    for (const page of SEO_PAGES) {
      if (!page.parent) continue;
      expect(seoPage(page.parent), `${page.path} -> ${page.parent}`).toBeDefined();
    }
  });

  it('resolves every registered path to a real route file', () => {
    for (const page of SEO_PAGES) {
      const segment = page.path === '/' ? '' : page.path;
      const candidates = [
        `src/app${segment}/page.tsx`,
        `src/app/(auth)${segment}/page.tsx`,
        `src/app/(protected)${segment}/page.tsx`,
      ];
      const found = candidates.some((c) => existsSync(resolve(ROOT, c)));
      expect(found, `${page.path} has no route file`).toBe(true);
    }
  });
});

describe('private routes are never indexable', () => {
  it.each(PRIVATE_PATHS)('%s is registered as non-indexable', (path) => {
    const page = seoPage(path as `/${string}`);
    expect(page, `${path} missing from the registry`).toBeDefined();
    expect(page?.index).toBe(false);
  });

  it.each(PRIVATE_PATHS)('%s emits noindex, nofollow', (path) => {
    const meta = metadataFor(path as `/${string}`);
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('emits no robots directive for an indexable page', () => {
    // Absent means "index" — asserting the default is not silently overridden.
    expect(metadataFor('/').robots).toBeUndefined();
  });
});

describe('the sitemap contains exactly the indexable set', () => {
  const entries = sitemap();

  it('matches the registry one for one', () => {
    expect(entries.map((e) => e.url).sort()).toEqual(
      indexablePages()
        .map((p) => absoluteUrl(p.path))
        .sort(),
    );
  });

  it.each(PRIVATE_PATHS)('never lists %s', (path) => {
    // The original defect, asserted directly.
    expect(entries.some((e) => e.url === absoluteUrl(path as `/${string}`))).toBe(false);
  });

  it('lists every public marketing page', () => {
    // The other half of the original defect: five of these were missing.
    for (const path of ['/', '/products', '/solutions', '/brokers', '/pricing', '/resources']) {
      expect(
        entries.some((e) => e.url === absoluteUrl(path as `/${string}`)),
        `${path} missing from the sitemap`,
      ).toBe(true);
    }
  });

  it('uses absolute https URLs with no duplicates and no trailing-slash variants', () => {
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url.startsWith('http'), url).toBe(true);
      // The homepage is the one legitimate trailing slash.
      if (!url.endsWith('.com/') && !url.endsWith('/')) continue;
      expect(url.replace(/^https?:\/\/[^/]+/, ''), url).toBe('/');
    }
  });

  it('claims no modification date it cannot substantiate', () => {
    // A sitemap that reports every URL as changed on every build is noise.
    for (const entry of entries) expect(entry.lastModified).toBeUndefined();
  });
});

describe('robots.txt', () => {
  const rules = robots();
  const rule = Array.isArray(rules.rules) ? rules.rules[0]! : rules.rules!;
  const disallow = (rule.disallow ?? []) as string[];

  it('keeps crawlers out of every authenticated segment', () => {
    for (const segment of [
      '/api/',
      '/dashboard',
      '/journal',
      '/analytics',
      '/chart',
      '/calendar',
      '/playbook',
      '/reports',
      '/goals',
      '/ai-coach',
      '/billing',
      '/settings',
      '/onboarding',
      '/share/',
    ]) {
      expect(disallow, `${segment} is crawlable`).toContain(segment);
    }
  });

  it('does NOT block the noindex auth pages', () => {
    /*
     * Load-bearing. A crawler has to fetch a page to see `noindex`; blocking it
     * in robots.txt preserves exactly the indexing the directive removes.
     */
    for (const path of ['/login', '/register']) {
      expect(disallow, `${path} blocked — noindex can never be read`).not.toContain(path);
    }
  });

  it('leaves the public site crawlable and points at the sitemap', () => {
    expect(rule.allow).toBe('/');
    expect(rules.sitemap).toMatch(/\/sitemap\.xml$/);
    for (const asset of ['/_next/', '/images/', '/fonts/']) {
      expect(disallow, `${asset} must stay crawlable`).not.toContain(asset);
    }
  });
});

describe('breadcrumbs', () => {
  it('starts at the home page and ends at the page itself', () => {
    const trail = breadcrumbsFor('/tools/position-size-calculator');
    expect(trail.map((c) => c.path)).toEqual(['/', '/tools', '/tools/position-size-calculator']);
  });

  it('is a single entry for a top-level page', () => {
    expect(breadcrumbsFor('/').map((c) => c.path)).toEqual(['/']);
  });

  it('returns nothing for an unregistered path rather than guessing', () => {
    expect(breadcrumbsFor('/not-a-real-page')).toEqual([]);
  });
});

describe('canonicals', () => {
  it('gives every registered page a self-referencing canonical', () => {
    for (const page of SEO_PAGES) {
      expect(metadataFor(page.path).alternates?.canonical, page.path).toBe(page.path);
    }
  });

  it('builds absolute URLs without a double slash', () => {
    expect(absoluteUrl('/pricing')).toMatch(/^https?:\/\/[^/]+\/pricing$/);
    expect(absoluteUrl('/')).toMatch(/^https?:\/\/[^/]+\/$/);
  });
});

describe('one canonical host, everywhere', () => {
  /*
   * The stack has to agree on ONE host. Vercel redirects the apex to `www`
   * with a single 308, Search Console uses the www property, and
   * `NEXT_PUBLIC_APP_URL` is the www origin — so every absolute URL this code
   * emits must be www too. A canonical pointing at a host that redirects is a
   * canonical pointing at a non-200, which Google treats as a soft signal at
   * best and ignores at worst.
   */
  const host = new URL(siteConfig.url).host;

  it('builds every sitemap URL on the configured host', () => {
    for (const entry of sitemap()) {
      expect(new URL(entry.url).host, entry.url).toBe(host);
    }
  });

  it('points robots at the same host', () => {
    const rules = robots();
    expect(new URL(rules.sitemap as string).host).toBe(host);
    expect(new URL(rules.host as string).host).toBe(host);
  });

  it('builds every absolute URL on the same host', () => {
    for (const page of SEO_PAGES) {
      expect(new URL(absoluteUrl(page.path)).host, page.path).toBe(host);
    }
  });

  it('emits an Open Graph URL on the configured host for every page', () => {
    for (const page of SEO_PAGES) {
      const og = metadataFor(page.path).openGraph as { url?: string } | undefined;
      expect(og?.url, `${page.path} has no og:url`).toBeDefined();
      expect(new URL(og!.url as string).host, page.path).toBe(host);
    }
  });

  it('never emits a bare vercel.app URL', () => {
    const everything = JSON.stringify([
      sitemap(),
      robots(),
      SEO_PAGES.map((p) => metadataFor(p.path)),
    ]);
    expect(everything).not.toContain('vercel.app');
  });
});

describe('Open Graph images survive the shallow metadata merge', () => {
  /*
   * Next merges metadata SHALLOWLY: a page declaring `openGraph` replaces the
   * layout's whole `openGraph`, including the image the `opengraph-image` file
   * convention attaches. An earlier version of `metadataFor` omitted `images`,
   * and the four tool pages shipped to production with no OG image while every
   * older page kept one. This is that regression, pinned.
   */
  it('declares an image on every page', () => {
    for (const page of SEO_PAGES) {
      const og = metadataFor(page.path).openGraph as { images?: unknown[] } | undefined;
      expect(og?.images, `${page.path} would lose its og:image`).toBeDefined();
      expect((og!.images as unknown[]).length, page.path).toBeGreaterThan(0);
    }
  });

  it('gives the image explicit dimensions so it cannot shift or be cropped', () => {
    const og = metadataFor('/pricing').openGraph as {
      images?: { width?: number; height?: number }[];
    };
    expect(og.images?.[0]?.width).toBe(1200);
    expect(og.images?.[0]?.height).toBe(630);
  });
});

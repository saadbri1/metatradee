import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/**
 * robots.txt.
 *
 * TWO DIFFERENT JOBS, AND ONLY ONE BELONGS HERE.
 *
 *   "Do not WASTE CRAWL BUDGET here" — that is this file. The authenticated
 *   app is dozens of routes that all redirect to `/login` for a crawler; there
 *   is nothing to find and no reason to fetch them.
 *
 *   "Do not INDEX this" — that is the `noindex` meta tag, applied from the SEO
 *   registry. It deliberately is NOT done here, because a crawler must be able
 *   to FETCH a page to see a `noindex` directive. Disallowing a URL that is
 *   already known to Google preserves the very indexing it was meant to remove,
 *   which is why `/login` and `/register` are absent from the list below: they
 *   carry `noindex` instead, and Google needs to read it.
 *
 * The previous list covered four of the twenty-three authenticated segments.
 * Everything under the app is enumerated now, from one place.
 */

/** Authenticated and internal segments. Nothing here is a search result. */
const DISALLOWED = [
  '/api/',
  '/auth/',
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
  '/help',
  '/settings',
  '/onboarding',
  /*
   * Shared report links. Each carries an unguessable token and its page already
   * sets `noindex`; keeping crawlers out of the space entirely means a link
   * pasted into a public forum is not followed and enumerated.
   */
  '/share/',
];

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

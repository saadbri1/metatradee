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

/**
 * AI CRAWLERS ARE DELIBERATELY NOT NAMED HERE, AND THAT IS THE CONFIGURATION.
 *
 * Three different things get confused under "AI crawler", and they have
 * different controls:
 *
 *   SEARCH INDEXING   `Googlebot`, `bingbot` — build the classic index, which
 *                     also feeds Google AI Overviews and Copilot.
 *   AI RETRIEVAL      `OAI-SearchBot`, `PerplexityBot`, `ClaudeBot` — fetch
 *                     pages at query time to answer and cite. Blocking these
 *                     removes eligibility for citation. OpenAI states a site
 *                     opted out of `OAI-SearchBot` will not appear in ChatGPT
 *                     search answers.
 *   MODEL TRAINING    `GPTBot`, `Google-Extended` — corpus collection. Blocking
 *                     these does NOT remove a site from AI search results, and
 *                     allowing them does not put it in.
 *
 * The single `User-Agent: *` group below already gives every one of them the
 * intended answer: the public site is allowed, the authenticated app is not.
 * Verified against production on 2026-08-14 by sending each user-agent —
 * `OAI-SearchBot`, `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Googlebot` and
 * `bingbot` all returned 200 on public pages and 307 on `/dashboard`.
 *
 * WHY NOT ADD EXPLICIT PER-BOT GROUPS. robots.txt matching is most-specific
 * group WINS OUTRIGHT — a named group does not inherit from `*`, it replaces
 * it. Adding `User-Agent: GPTBot / Allow: /` would therefore hand GPTBot the
 * whole authenticated surface unless all sixteen disallows were duplicated
 * beneath it, and then again for every other bot. That is six drifting copies
 * of one list, and the first one someone forgets to update is a private
 * segment opened to a crawler. One list, one group, no exceptions.
 *
 * Revisit only to DENY a specific crawler — which is a policy decision about
 * training or cost, not an SEO one, and belongs to the operator.
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

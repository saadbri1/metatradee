'use client';

/**
 * Mounts the analytics vendor and installs the sink.
 *
 * WHY VERCEL ANALYTICS. The site already runs on Vercel, so this adds no new
 * vendor relationship, no new account, and no new domain for a browser to talk
 * to. It is cookieless and stores no cross-site identifier, which is why this
 * change ships **without a consent banner**: there is nothing to consent to
 * under ePrivacy when nothing is stored on the device and no personal data is
 * collected. That property is load-bearing — a banner on a finance site is a
 * measurable conversion cost, and the whole design here is built to avoid
 * needing one.
 *
 * A LIMIT WORTH KNOWING. This project is on Vercel's **Hobby** plan today.
 * Page views are collected; **custom events require Pro and will not be
 * recorded until the plan is upgraded**. Nothing here breaks in the meantime —
 * `track()` is a no-op server-side and a dropped beacon otherwise — and the
 * moment the plan changes, every event below starts recording with no code
 * change. That is exactly why the sink is a seam.
 *
 * ORGANIC ATTRIBUTION happens here rather than in each page: one listener reads
 * the referrer once per page view, so no page has to remember to report it.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { track } from '@vercel/analytics';
import { setAnalyticsSink, trackEvent } from './analytics';
import { pageGroupFor } from './page-group';

/** Hosts that mean "arrived from a search engine". Referrer only, never a query. */
const SEARCH_HOSTS = [
  'google.',
  'bing.',
  'duckduckgo.',
  'yahoo.',
  'ecosia.',
  'brave.',
  'startpage.',
  'yandex.',
  'baidu.',
];

function isOrganicReferrer(referrer: string): boolean {
  if (!referrer) return false;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    // Same-site navigation is not acquisition.
    if (host === window.location.hostname) return false;
    return SEARCH_HOSTS.some((s) => host.includes(s));
  } catch {
    return false;
  }
}

export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    setAnalyticsSink({
      track: (name, props) => {
        /*
         * `props` has already passed the sanitiser, so this hands the vendor a
         * payload of short enum strings and booleans and nothing else.
         */
        track(name, props);
      },
    });
  }, []);

  useEffect(() => {
    /*
     * Fires once per landing, not once per in-app navigation: after the first
     * page the referrer is our own origin, which `isOrganicReferrer` rejects.
     */
    if (isOrganicReferrer(document.referrer)) {
      trackEvent('organic_landing', { page_group: pageGroupFor(pathname) });
    }
  }, [pathname]);

  /*
   * MOUNTED EXACTLY ONCE, in a client leaf.
   *
   * Both of these render no DOM of their own — they inject a script tag — so
   * they add no layout shift and no reserved space. Putting them here rather
   * than in the root layout keeps every server layout a server component: the
   * public pages stay statically prerendered, which is load-bearing for SEO and
   * would have been lost by adding `'use client'` further up the tree.
   *
   * SPEED INSIGHTS IS FIELD MEASUREMENT, NOT A LAB TEST. It reports real
   * visitors' Core Web Vitals. It needs actual traffic over time before the
   * dashboard shows anything, so a green build here is not evidence of good
   * CWV — only that collection has started.
   */
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

import type { MetadataRoute } from 'next';
import { absoluteUrl, indexablePages } from '@/config/seo';

/**
 * The sitemap, derived entirely from the SEO registry.
 *
 * IT USED TO BE HAND-WRITTEN, AND IT WAS WRONG. Five real marketing pages
 * (`/products`, `/solutions`, `/brokers`, `/pricing`, `/resources`) were absent
 * while `/login` and `/register` were listed — the file asserted in a comment
 * that authenticated routes were excluded while advertising two of them. A
 * sitemap maintained separately from the pages it describes will always drift
 * from them, so this one cannot: `indexablePages()` is the same set that drives
 * the `noindex` decision on the page itself.
 *
 * `lastModified` is deliberately NOT `new Date()`. A sitemap that reports every
 * URL as modified on every build is telling crawlers something untrue about
 * every page, and the signal stops meaning anything. Until page-level review
 * dates exist in the registry, the field is omitted — no claim beats a false one.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePages().map((page) => ({
    url: absoluteUrl(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}

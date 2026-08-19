import { NextResponse } from 'next/server';
import { SEO_PAGES, absoluteUrl, indexablePages, type SeoPage } from '@/config/seo';
import { siteConfig } from '@/config/site';

/**
 * `/llms.txt` — a plain-text map of the public site for machine consumption.
 *
 * READ THE DECISION BEFORE CHANGING THIS FILE.
 * `docs/ai-search-discovery-plan.md` §6 evaluated `llms.txt` and initially
 * declined it. That reasoning still stands on the only question that matters
 * for expectations: **no major AI provider documents production support for it,
 * and Google has stated it does not use it.** Nothing here is a ranking factor
 * and nothing here will produce a citation. It is shipped as a low-cost,
 * zero-risk convenience for the clients that do read it, and for nothing else.
 *
 * WHAT CHANGED. The original objection was not really about value, it was about
 * DRIFT: a hand-written third copy of the product facts that silently goes
 * stale is worse than no file, in a format built for machines to trust. That
 * objection dissolves when the file is generated rather than written — which is
 * what §6 itself prescribed as the precondition ("If it is ever added, generate
 * it from the SEO registry... Never hand-write it").
 *
 * So: EVERY line below derives from `SEO_PAGES` and `siteConfig`. There is no
 * literal URL, title or description in this file. A page added to the registry
 * appears here automatically; a page removed disappears. It cannot disagree
 * with the sitemap, the canonicals or the page metadata, because all four read
 * the same array.
 *
 * NON-INDEXABLE PAGES ARE EXCLUDED. `indexablePages()` is the same filter the
 * sitemap uses, so auth screens and the authenticated app never appear here.
 */

/** Group the registry by its top-level segment, preserving registry order. */
function sectionsOf(pages: SeoPage[]): Map<string, SeoPage[]> {
  const groups = new Map<string, SeoPage[]>();
  for (const page of pages) {
    if (page.path === '/') continue;
    const segment = page.path.split('/')[1] ?? '';
    const heading =
      segment === 'tools'
        ? 'Free calculators'
        : segment === 'integrations'
          ? 'Platform imports'
          : 'Product and company';
    const bucket = groups.get(heading);
    if (bucket) bucket.push(page);
    else groups.set(heading, [page]);
  }
  return groups;
}

export const dynamic = 'force-static';

export function GET() {
  const home = SEO_PAGES.find((p) => p.path === '/');
  const lines: string[] = [
    `# ${siteConfig.name}`,
    '',
    `> ${siteConfig.description}`,
    '',
    /*
     * The boundary statement. An answer engine summarising this product from
     * the marketing pages alone could reasonably conclude it connects to a
     * broker or runs backtests; both are false, and both are corrected on the
     * pages themselves. Stating it here too costs two lines and removes the
     * most likely way for a machine-written summary to be wrong about us.
     */
    'MetaTradee is a record-keeping and review tool. It does not place trades, does',
    'not connect to a live brokerage account, and does not provide financial advice.',
    'Trade history is imported from statement files that the trader exports and',
    'uploads. Automated backtesting is not available.',
    '',
  ];

  if (home) lines.push(`- [Home](${absoluteUrl(home.path)}): ${home.description}`, '');

  for (const [heading, pages] of sectionsOf(indexablePages())) {
    lines.push(`## ${heading}`, '');
    for (const page of pages) {
      lines.push(`- [${page.title}](${absoluteUrl(page.path)}): ${page.description}`);
    }
    lines.push('');
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}

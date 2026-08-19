/**
 * `/llms.txt`.
 *
 * THE POINT OF THESE TESTS IS DRIFT, NOT FORMAT. `docs/ai-search-discovery-plan.md`
 * §6 declined this file for one reason — a hand-maintained third copy of the
 * product facts goes stale silently, in a format built for machines to trust —
 * and admitted it only on the condition that it be generated. Everything below
 * enforces that condition: if the file and the registry can disagree, the file
 * should not exist.
 */
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/llms.txt/route';
import { SEO_PAGES, absoluteUrl, indexablePages } from '@/config/seo';
import { siteConfig } from '@/config/site';

async function body(): Promise<string> {
  return await GET().text();
}

describe('it is served as plain text', () => {
  it('sets a text/plain content type', async () => {
    expect(GET().headers.get('Content-Type')).toMatch(/^text\/plain/);
  });

  it('names the product and states what it is', async () => {
    const text = await body();
    expect(text.startsWith(`# ${siteConfig.name}`)).toBe(true);
    expect(text).toContain(siteConfig.description);
  });
});

describe('it lists exactly the indexable set', () => {
  it('includes every indexable page', async () => {
    const text = await body();
    for (const page of indexablePages()) {
      expect(text, `${page.path} missing`).toContain(absoluteUrl(page.path));
    }
  });

  it('leaks no non-indexable route', async () => {
    /*
     * The failure that would matter: an auth screen or the authenticated app
     * advertised to every AI client that reads this file.
     */
    const text = await body();
    for (const page of SEO_PAGES.filter((p) => !p.index)) {
      expect(text, `${page.path} exposed`).not.toContain(absoluteUrl(page.path));
    }
  });

  it('mentions no private application segment', async () => {
    const text = await body();
    for (const seg of ['/dashboard', '/journal', '/settings', '/billing', '/share/', '/api/']) {
      expect(text, `${seg} exposed`).not.toContain(seg);
    }
  });

  it('lists the same number of pages as the sitemap', async () => {
    const text = await body();
    const listed = (text.match(/^- \[/gm) ?? []).length;
    // Home is listed once on its own, then every other indexable page.
    expect(listed).toBe(indexablePages().length);
  });
});

describe('nothing in it is hand-written', () => {
  it('uses the registry description for every page it lists', async () => {
    const text = await body();
    for (const page of indexablePages()) {
      expect(text, `${page.path} description drifted`).toContain(page.description);
    }
  });

  it('builds every URL on the canonical host', async () => {
    const text = await body();
    const host = new URL(siteConfig.url).host;
    for (const url of text.match(/https?:\/\/[^\s)]+/g) ?? []) {
      expect(new URL(url).host, url).toBe(host);
    }
  });
});

describe('it states the product boundaries', () => {
  /*
   * The two things a summariser is most likely to get wrong about this product,
   * asserted here because this file is read by machines with no other context.
   *
   * Whitespace-collapsed before matching: the source wraps these sentences for
   * readability, and where the line break happens to fall is a formatting
   * choice, not a fact worth pinning.
   */
  const flat = async () => (await body()).replace(/\s+/g, ' ');
  it('says it does not connect to a live brokerage account', async () => {
    expect(await flat()).toMatch(/does not connect to a live brokerage account/i);
  });

  it('says backtesting is not available', async () => {
    expect(await flat()).toMatch(/backtesting is not available/i);
  });

  it('says it is not financial advice', async () => {
    expect(await flat()).toMatch(/does not provide financial advice/i);
  });
});

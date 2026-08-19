/**
 * The JSON-LD graph.
 *
 * THE RULE EVERY TEST HERE ENFORCES: structured data may only assert things the
 * rendered page also says, and only about things that exist. Markup that
 * outruns the product is what earns a manual action, and it never arrives as an
 * obvious lie — it arrives as a recommended property somebody filled in to
 * silence a validator warning.
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ORGANIZATION_ID,
  SOFTWARE_ID,
  WEBSITE_ID,
  LOGO_URL,
  faqPageLdFrom,
  organizationLd,
  serializeJsonLd,
  softwareApplicationLd,
  websiteLd,
} from '@/features/marketing/seo';
import { FAQS } from '@/features/marketing/data';
import { siteConfig } from '@/config/site';

const ROOT = resolve(__dirname, '../../..');
const HOST = new URL(siteConfig.url).host;

describe('the entity graph is one company, one site, one product', () => {
  it('gives every node a stable @id on the canonical host', () => {
    for (const id of [ORGANIZATION_ID, SOFTWARE_ID, WEBSITE_ID]) {
      expect(new URL(id).host, id).toBe(HOST);
      expect(id, `${id} needs a fragment — it is a node, not a page`).toContain('#');
    }
  });

  it('uses a different @id for each node', () => {
    const ids = [ORGANIZATION_ID, SOFTWARE_ID, WEBSITE_ID];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points the website and the application at the organization', () => {
    expect((websiteLd().publisher as { '@id': string })['@id']).toBe(ORGANIZATION_ID);
    expect((softwareApplicationLd().publisher as { '@id': string })['@id']).toBe(ORGANIZATION_ID);
  });
});

describe('Organization', () => {
  const org = organizationLd() as Record<string, unknown>;

  it('declares a logo that is a file actually in the build', () => {
    expect(org.logo).toBe(LOGO_URL);
    /*
     * The App Router metadata convention serves `src/app/apple-icon.png` at
     * `/apple-icon.png`. If that file is ever renamed, the logo becomes a 404
     * that Google fetches on every crawl — so assert the source exists rather
     * than trusting the string.
     */
    expect(existsSync(resolve(ROOT, 'src/app/apple-icon.png'))).toBe(true);
    expect(new URL(LOGO_URL).host).toBe(HOST);
  });

  it('claims no social profiles, because none are recorded anywhere', () => {
    /*
     * `sameAs` asserts ownership of accounts on other services. Inventing
     * plausible handles to clear a validator warning would assert ownership of
     * accounts MetaTradee may not control. Delete this test the day real
     * profile URLs land in config — not before.
     */
    expect(org.sameAs).toBeUndefined();
  });

  it('publishes no internal mailbox', () => {
    expect(serializeJsonLd(org)).not.toContain('admin@');
  });
});

describe('WebSite', () => {
  const site = websiteLd() as Record<string, unknown>;

  it('names the site and its language', () => {
    expect(site.name).toBe(siteConfig.name);
    expect(site.url).toBe(siteConfig.url);
    expect(site.inLanguage).toBe('en');
  });

  it('declares no sitelinks search box, because there is no public search route', () => {
    /*
     * `potentialAction`/`SearchAction` asserts a working site-wide search
     * endpoint. There is no `/search` route in `src/app`, so the markup would
     * describe a URL template that 404s.
     */
    expect(site.potentialAction).toBeUndefined();
    expect(existsSync(resolve(ROOT, 'src/app/search/page.tsx'))).toBe(false);
  });
});

describe('FAQPage is generated from the rendered array, never a copy', () => {
  it('emits exactly the questions it was given, in order', () => {
    const faqs = [
      { q: 'First?', a: 'Yes.' },
      { q: 'Second?', a: 'No.' },
    ];
    const ld = faqPageLdFrom(faqs) as { mainEntity: { name: string }[] };
    expect(ld.mainEntity.map((e) => e.name)).toEqual(['First?', 'Second?']);
  });

  it('carries every homepage FAQ answer verbatim', () => {
    const ld = faqPageLdFrom(FAQS) as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(ld.mainEntity).toHaveLength(FAQS.length);
    for (const [i, faq] of FAQS.entries()) {
      expect(ld.mainEntity[i]!.name).toBe(faq.q);
      expect(ld.mainEntity[i]!.acceptedAnswer.text).toBe(faq.a);
    }
  });

  it('produces no FAQPage from an empty list rather than an empty one', () => {
    // An empty `mainEntity` is a FAQ rich result with no questions in it.
    const ld = faqPageLdFrom([]) as { mainEntity: unknown[] };
    expect(ld.mainEntity).toEqual([]);
  });
});

describe('every emission survives embedding in a <script> tag', () => {
  it('escapes anything that could close the block early', () => {
    const hostile = serializeJsonLd({ a: '</script><img onerror=alert(1)>' });
    expect(hostile).not.toContain('</script');
    expect(hostile).toContain('\\u003c');
  });

  it('escapes the line separators that are invalid in a JS string', () => {
    // Escapes, not literal separators: raw U+2028 in source is editor-fragile.
    expect(serializeJsonLd({ a: '\u2028\u2029' })).toBe('{"a":"\\u2028\\u2029"}');
  });

  it('emits parseable JSON for the whole homepage graph', () => {
    const graph = [organizationLd(), websiteLd(), softwareApplicationLd(), faqPageLdFrom(FAQS)];
    const parsed = JSON.parse(serializeJsonLd(graph).replace(/\\u003c/g, '<'));
    expect(parsed).toHaveLength(4);
    for (const node of parsed) expect(node['@context']).toBe('https://schema.org');
  });
});

describe('nothing in the graph invents a commercial claim', () => {
  it('states no rating, review count or price it cannot show on the page', () => {
    const graph = serializeJsonLd([organizationLd(), websiteLd(), softwareApplicationLd()]);
    for (const forbidden of ['aggregateRating', 'reviewCount', 'ratingValue', 'award']) {
      expect(graph, `${forbidden} is not substantiated anywhere on the site`).not.toContain(
        forbidden,
      );
    }
  });
});

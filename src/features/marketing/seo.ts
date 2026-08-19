import { COMPANY_EMAILS } from '@/config/contact';
/**
 * Structured data (JSON-LD) for the public site, built from the same sources as
 * the rendered page so it never drifts. Organization + SoftwareApplication +
 * FAQPage. No fabricated ratings, prices, or review counts.
 */
import { siteConfig } from '@/config/site';
import { FAQS, type Faq } from './data';

/**
 * Serialize JSON-LD for safe embedding in a `<script>` tag.
 *
 * Inside raw text elements the parser ends the script at the first `</script`
 * sequence, so a `<` in any value could break out of the block. Today every
 * input here is internal static config, but escaping `<` (plus the U+2028/2029
 * separators that are invalid in JS string literals) makes that structurally
 * impossible rather than merely true-for-now — defense in depth if any of this
 * ever becomes user-supplied.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    /*
     * A real file, not a placeholder. See LOGO_URL.
     *
     * NO `sameAs`. That property lists the official profiles of this entity on
     * other services, and MetaTradee has none recorded anywhere in this
     * repository. Guessing plausible handles would assert ownership of accounts
     * we may not control — worse than the missing-recommended-property warning
     * that omitting it produces.
     */
    logo: LOGO_URL,
    /*
     * Public contact points only. The administrative mailbox is never
     * published here — structured data is crawled and indexed, which is the
     * fastest way for an internal address to end up scraped.
     */
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: COMPANY_EMAILS.support,
        availableLanguage: ['en'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: COMPANY_EMAILS.sales,
        availableLanguage: ['en'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: COMPANY_EMAILS.contact,
        availableLanguage: ['en'],
      },
    ],
  };
}

/**
 * STABLE NODE IDENTIFIERS, so the whole site describes ONE company and ONE
 * application rather than a new anonymous entity per page.
 *
 * Without an `@id`, the `SoftwareApplication` on the homepage, the one on
 * /pricing carrying the offers, and the one on /products carrying the feature
 * list are three unrelated nodes that happen to share a name — and a consumer
 * building an entity graph has to guess whether they are the same product.
 * Anchoring every emission to these two URIs makes the answer explicit, and
 * makes the canonical website unambiguous while it does so.
 *
 * The fragment form (`https://host/#software`) is the conventional way to name
 * a node that is not itself a fetchable page.
 */
export const ORGANIZATION_ID = `${siteConfig.url.replace(/\/$/, '')}/#organization`;
export const SOFTWARE_ID = `${siteConfig.url.replace(/\/$/, '')}/#software`;
export const WEBSITE_ID = `${siteConfig.url.replace(/\/$/, '')}/#website`;

/**
 * The brand mark, as a real file that already ships.
 *
 * `apple-icon.png` is the App Router metadata convention and is served at this
 * path; it is the MetaTradee mark at 180×180 on an opaque background, which
 * clears Google's 112×112 minimum for an `Organization` logo. Pointing at the
 * 1200×630 `opengraph-image` instead would be wrong — that is a social card
 * with a headline on it, not a logo, and Google renders this one as the site's
 * identity in its own surfaces.
 */
export const LOGO_URL = `${siteConfig.url.replace(/\/$/, '')}/apple-icon.png`;

/**
 * `WebSite`, so the site is ONE named entity rather than an implicit one.
 *
 * This is what lets a consumer connect the canonical host to the publisher of
 * everything on it, and it is the node Google reads for the site-name treatment
 * in search results.
 *
 * DELIBERATELY NO `potentialAction`/`SearchAction`. The sitelinks-searchbox
 * markup asserts that a site-wide search endpoint exists at a given URL
 * template. MetaTradee has no public search route, so declaring one would be a
 * structured-data claim about a page that returns a 404 — exactly the kind of
 * markup-that-outruns-the-product this file exists to prevent. Add it the day a
 * real public `/search?q=` ships, not before.
 */
export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: 'en',
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function softwareApplicationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE_ID,
    name: siteConfig.name,
    applicationCategory: 'FinanceApplication',
    applicationSubCategory: 'Trading journal',
    operatingSystem: 'Web',
    description: siteConfig.description,
    url: siteConfig.url,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

/**
 * `FAQPage` for an ARBITRARY list of questions.
 *
 * The rule this exists to enforce: the argument must be the same array the page
 * renders. Structured data describing questions a reader cannot see on the page
 * is precisely what earns a manual action, and the way that happens in practice
 * is someone hand-writing a second copy of the list. Pass the rendered array,
 * never a duplicate of it.
 */
export function faqPageLdFrom(faqs: readonly Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function faqPageLd() {
  return faqPageLdFrom(FAQS);
}

/**
 * Structured data (JSON-LD) for the public site, built from the same sources as
 * the rendered page so it never drifts. Organization + SoftwareApplication +
 * FAQPage. No fabricated ratings, prices, or review counts.
 */
import { siteConfig } from '@/config/site';
import { FAQS } from './data';

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
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
  };
}

export function softwareApplicationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description: siteConfig.description,
    url: siteConfig.url,
  };
}

export function faqPageLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

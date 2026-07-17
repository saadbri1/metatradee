/**
 * Structured data (JSON-LD) for the public site, built from the same sources as
 * the rendered page so it never drifts. Organization + SoftwareApplication +
 * FAQPage. No fabricated ratings, prices, or review counts.
 */
import { siteConfig } from '@/config/site';
import { FAQS } from './data';

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

import type { Metadata } from 'next';
import {
  MarketingPage,
  organizationLd,
  softwareApplicationLd,
  faqPageLd,
} from '@/features/marketing';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: `${siteConfig.name} — AI Trading Journal & Performance Analytics`,
  description: siteConfig.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — AI Trading Journal & Performance Analytics`,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — AI Trading Journal & Performance Analytics`,
    description: siteConfig.description,
  },
};

/** Public homepage. Thin route: composes the marketing feature module and emits
 *  structured data. All styling/layout lives in `@/features/marketing`. */
export default function HomePage() {
  const jsonLd = [organizationLd(), softwareApplicationLd(), faqPageLd()];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingPage />
    </>
  );
}

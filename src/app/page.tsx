import type { Metadata } from 'next';
import { metadataFor } from '@/config/seo';
import {
  MarketingPage,
  organizationLd,
  softwareApplicationLd,
  faqPageLd,
  serializeJsonLd,
} from '@/features/marketing';

export const metadata: Metadata = metadataFor('/');

/** Public homepage. Thin route: composes the marketing feature module and emits
 *  structured data. All styling/layout lives in `@/features/marketing`. */
export default function HomePage() {
  const jsonLd = [organizationLd(), softwareApplicationLd(), faqPageLd()];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <MarketingPage />
    </>
  );
}

import { PublicShell } from './public-shell';
import { Hero } from './hero';
import { FormatMarquee } from './marquee';
import { Ecosystem } from './ecosystem';
import { HowItWorks } from './how-it-works';
import { StickyShowcase } from './sticky-showcase';
import { ProductSections } from './product-sections';
import { Pricing } from './pricing';
import { Faq } from './faq';
import { FinalCta } from './cta';

/**
 * Composes the public homepage. The header, footer, skip link and reveal
 * observer come from `PublicShell`, which every public page shares — so the
 * homepage cannot end up with a different header from /products or /pricing.
 */
export function MarketingPage() {
  return (
    <PublicShell>
      <div className="route-reveal">
        <Hero />
        <FormatMarquee />
        <Ecosystem />
        <HowItWorks />
        <StickyShowcase />
        <ProductSections />
        <Pricing />
        <Faq />
        <FinalCta />
      </div>
    </PublicShell>
  );
}

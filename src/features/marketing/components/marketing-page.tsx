import { PublicShell } from './public-shell';
import { Hero } from './hero';
import { SupportedPlatformsSection } from './supported-platforms';
import { Ecosystem } from './ecosystem';
import { HowItWorks } from './how-it-works';
import { StickyShowcase } from './sticky-showcase';
import { ReplayShowcaseSection } from './replay-showcase-section';
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
        <SupportedPlatformsSection />
        <Ecosystem />
        <HowItWorks />
        <StickyShowcase />
        <ProductSections />
        {/* Capability showcase: after the feature deep-dives, before pricing. */}
        <ReplayShowcaseSection />
        <Pricing />
        <Faq />
        <FinalCta />
      </div>
    </PublicShell>
  );
}

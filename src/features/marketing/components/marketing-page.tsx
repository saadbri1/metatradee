import { MarketingNav } from './marketing-nav';
import { RevealObserver } from '../motion/reveal-observer';
import { Hero } from './hero';
import { Ecosystem } from './ecosystem';
import { ProductSections } from './product-sections';
import { Pricing } from './pricing';
import { Faq } from './faq';
import { FinalCta } from './cta';
import { MarketingFooter } from './footer';

/** Composes the public homepage. Server-rendered; only nav/pricing/motion wrappers
 *  are client islands. The route file stays thin and imports this. */
export function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <RevealObserver />
      <MarketingNav />
      <main id="main" className="flex-1">
        <Hero />
        <Ecosystem />
        <ProductSections />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}

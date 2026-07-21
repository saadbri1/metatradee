import { MarketingNav } from './marketing-nav';
import { RevealObserver } from '../motion/reveal-observer';
import { Hero } from './hero';
import { FormatMarquee } from './marquee';
import { Ecosystem } from './ecosystem';
import { HowItWorks } from './how-it-works';
import { StickyShowcase } from './sticky-showcase';
import { ProductSections } from './product-sections';
import { Pricing } from './pricing';
import { Faq } from './faq';
import { FinalCta } from './cta';
import { MarketingFooter } from './footer';

/** Composes the public homepage. Server-rendered; client islands are limited to
 *  nav, pricing toggle, the reveal observer, the sticky showcase (Framer), and
 *  small spotlight/magnetic wrappers. The route file stays thin. */
export function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <RevealObserver />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <MarketingNav />
      <main id="main" className="route-reveal flex-1">
        <Hero />
        <FormatMarquee />
        <Ecosystem />
        <HowItWorks />
        <StickyShowcase />
        <ProductSections />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}

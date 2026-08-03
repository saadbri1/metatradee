import Image from 'next/image';
import { SUPPORTED_FORMATS } from '../data';

/**
 * Supported-platform logos.
 *
 * WHICH BRANDS APPEAR IS A COMPATIBILITY CLAIM, not a design choice, so this
 * list is the set MetaTradee can actually import from today — verified in the
 * code, not assumed:
 *
 *   MetaTrader 4 / 5   features/import/adapters.ts, parse.ts
 *   Interactive Brokers features/integrations/ibkr/* (Flex Web Service)
 *
 * The section was specified with Webull, NinjaTrader and TD Ameritrade as well.
 * None of the three appears anywhere in this repository — no adapter, no
 * parser, no integration — so a visitor reading their logo here would be told
 * something untrue about what their account can import. They are left out until
 * the import path exists. cTrader IS supported but has no logo asset, so it
 * stays in the format line below rather than being drawn by hand.
 *
 * Replaces the old text-pill FormatMarquee. Two marquees making the same claim
 * on one page would be worse than either alone, and the formats without a brand
 * mark (CSV, Excel, manual entry) are carried in the supporting line.
 */

interface PlatformLogo {
  src: string;
  alt: string;
  width: number;
  height: number;
  /**
   * Optical, not mathematical. A wide wordmark and a stacked icon-over-text
   * lockup set to the same pixel height do not read as the same size — the
   * wordmark dominates. These are tuned so the three carry equal weight.
   */
  heightClass: string;
}

const PLATFORMS: PlatformLogo[] = [
  {
    src: '/images/platforms/interactive-brokers.png',
    alt: 'Interactive Brokers',
    width: 572,
    height: 83,
    heightClass: 'h-5 sm:h-6',
  },
  {
    src: '/images/platforms/metatrader-4.png',
    alt: 'MetaTrader 4',
    width: 335,
    height: 256,
    heightClass: 'h-10 sm:h-12',
  },
  {
    src: '/images/platforms/metatrader-5.png',
    alt: 'MetaTrader 5',
    width: 563,
    height: 429,
    heightClass: 'h-10 sm:h-12',
  },
];

/**
 * Infinite horizontal logo row.
 *
 * Pure CSS, using the project's existing `.marquee` / `.marquee-track` pair in
 * globals.css rather than a new animation: the track holds the list TWICE and
 * translates -50%, so the second copy is exactly where the first started when
 * the loop restarts — no jump. It pauses on hover and is already scoped inside
 * `prefers-reduced-motion: no-preference`, so a reduced-motion visitor gets a
 * static row instead of a stopped-looking one.
 *
 * The duplicate set is aria-hidden, so a screen reader hears each brand once.
 */
function LogoMarquee() {
  return (
    <div
      className="marquee group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      role="list"
      aria-label="Supported trading platforms"
    >
      <div className="marquee-track flex w-max items-center">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            className="flex w-max items-center gap-12 pr-12 sm:gap-16 sm:pr-16"
            {...(copy === 1 ? { 'aria-hidden': true } : {})}
          >
            {PLATFORMS.map((logo) => (
              <li key={logo.src} className="flex h-12 shrink-0 items-center sm:h-14">
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={logo.width}
                  height={logo.height}
                  /* Height is fixed per logo; width follows the mark's own
                     proportions, so nothing is ever stretched or cropped. */
                  className={`w-auto object-contain ${logo.heightClass}`}
                  sizes="200px"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function SupportedPlatformsSection() {
  return (
    <section
      aria-labelledby="platforms-heading"
      className="border-y border-border/50 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Supported platforms
        </p>
        <h2
          id="platforms-heading"
          className="mx-auto mt-3 max-w-2xl text-balance font-display text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Works with the tools traders already use
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-muted-foreground">
          Import, review and analyse your trading activity from the platforms you already trade on.
        </p>
      </div>

      <div className="mt-10">
        <LogoMarquee />
      </div>

      {/*
       * The formats that are supported but are not brands — plus cTrader,
       * which is a brand we support but have no logo asset for. Naming them in
       * text keeps the claim complete without drawing a mark by hand.
       */}
      <p className="mx-auto mt-8 max-w-2xl px-4 text-center text-xs text-muted-foreground">
        Also imports from {SUPPORTED_FORMATS.filter((f) => !f.startsWith('MetaTrader')).join(', ')}.
      </p>
    </section>
  );
}

import Image from 'next/image';
import { SUPPORTED_FORMATS } from '../data';

/**
 * Supported-platform logos.
 *
 * ASSET STATUS drives what renders. `platformLogos` below is the explicit
 * six-brand list; an entry with `src: null` has NO logo file in this repository
 * and is skipped at render time rather than pointed at a path that 404s — a
 * broken image icon in a trust row is worse than a shorter row.
 *
 * MISSING, searched for and not found anywhere in the project, in
 * public/**, or in the supplied uploads:
 *
 *   public/images/platforms/webull.svg
 *   public/images/platforms/td-ameritrade.svg
 *
 * Drop either file in and set its `src` — no other change is needed.
 *
 * A NOTE ON THE CLAIM. Of the six, the import path exists for MetaTrader 4/5
 * (features/import/adapters.ts) and Interactive Brokers
 * (features/integrations/ibkr/*). Webull, NinjaTrader and TD Ameritrade have no
 * adapter, parser or integration in this repository. That was raised and the
 * decision was made to show them regardless, so the section heading no longer
 * asserts that MetaTradee works with every logo shown — it says these are the
 * platforms traders use, and the line beneath names what actually imports
 * today. TD Ameritrade is also a retired brand, folded into Schwab in 2024.
 */

interface PlatformLogo {
  name: string;
  /** null = no asset in the repo yet; the entry is kept but not rendered. */
  src: string | null;
  alt: string;
  width: number;
  height: number;
  /**
   * Optical, not mathematical. A wide wordmark and a square icon tile set to
   * the same pixel height do not read as the same size — the wordmark
   * dominates. Tuned so every mark carries comparable weight in the row.
   */
  heightClass: string;
}

const platformLogos: PlatformLogo[] = [
  {
    name: 'Webull',
    src: null,
    alt: 'Webull logo',
    width: 0,
    height: 0,
    heightClass: 'h-6 sm:h-7',
  },
  {
    name: 'MetaTrader 5',
    src: '/images/platforms/metatrader-5.png',
    alt: 'MetaTrader 5 logo',
    width: 563,
    height: 429,
    heightClass: 'h-10 sm:h-12',
  },
  {
    name: 'NinjaTrader',
    src: '/images/platforms/ninjatrader.png',
    alt: 'NinjaTrader logo',
    width: 300,
    height: 300,
    heightClass: 'h-11 sm:h-13',
  },
  {
    name: 'Interactive Brokers',
    src: '/images/platforms/interactive-brokers.png',
    alt: 'Interactive Brokers logo',
    width: 572,
    height: 83,
    heightClass: 'h-5 sm:h-6',
  },
  {
    name: 'TD Ameritrade',
    src: null,
    alt: 'TD Ameritrade logo',
    width: 0,
    height: 0,
    heightClass: 'h-6 sm:h-7',
  },
  {
    name: 'MetaTrader 4',
    src: '/images/platforms/metatrader-4.png',
    alt: 'MetaTrader 4 logo',
    width: 335,
    height: 256,
    heightClass: 'h-10 sm:h-12',
  },
];

/** Only the entries whose asset actually exists. */
const RENDERABLE = platformLogos.filter((l): l is PlatformLogo & { src: string } => l.src !== null);

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
            {RENDERABLE.map((logo) => (
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
          Built for the platforms traders already use
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-muted-foreground">
          Import, review and analyse your trading activity from the platform you trade on.
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
      {/*
       * States exactly what imports today. The row above shows the platforms
       * MetaTradee is built around; this names the paths that are live, so a
       * visitor can tell the difference without reading a roadmap.
       */}
      <p className="mx-auto mt-8 max-w-2xl px-4 text-center text-xs text-muted-foreground">
        Importing today: MetaTrader 4 and 5, Interactive Brokers, {''}
        {SUPPORTED_FORMATS.filter((f) => !f.startsWith('MetaTrader')).join(', ')}. More broker
        integrations are in progress.
      </p>
    </section>
  );
}

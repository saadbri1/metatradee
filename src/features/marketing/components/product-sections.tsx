import Image from 'next/image';
import { Check } from 'lucide-react';
import { PRODUCT_SECTIONS, SHOWCASE, type ProductSection } from '../data';
import { Reveal } from '../motion/reveal';

/**
 * Alternating deep-dive sections for the modules NOT covered by the cinematic
 * sticky showcase (so every module appears exactly once). The visual side
 * alternates sides on wide screens. Semantic headings, keyboard-agnostic,
 * reduced-motion safe.
 */
const SHOWCASE_IDS = new Set(SHOWCASE.map((s) => s.id));
const SECTIONS = PRODUCT_SECTIONS.filter((s) => !SHOWCASE_IDS.has(s.id));

/**
 * The visual half of a row.
 *
 * A real product screenshot when the section has one, otherwise the abstract
 * motif. The fallback is kept deliberately rather than deleted: a section
 * whose screenshot has not been supplied yet should degrade to an on-brand
 * placeholder instead of rendering an empty frame or crashing the page.
 */
function SectionVisual({ section }: { section: ProductSection }) {
  if (section.image) {
    return (
      <div
        className={
          // Same 4:3 box for every row, so the five media columns line up and
          // the space is reserved before the image loads — no layout shift.
          // The screenshots are authored at exactly 4:3, so object-contain
          // fills it without letterboxing and without ever distorting them.
          'premium-hover relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-card ' +
          'shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] transition-[transform,border-color,box-shadow]' +
          'duration-normal ease-out motion-reduce:transition-none'
        }
      >
        {/* Ambient tint, kept very low so it never sits over the screenshot's
            own whites. Behind the image, never on top of it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent"
        />
        <Image
          src={section.image.src}
          alt={section.image.alt}
          width={section.image.width}
          height={section.image.height}
          /*
           * Half the 1152px content column on lg+, full width below it. Without
           * this the browser assumes 100vw and downloads a needlessly large
           * file for a column that is never wider than ~560px.
           */
          sizes="(min-width: 1024px) 560px, (min-width: 640px) 90vw, 100vw"
          className="relative h-full w-full object-contain object-center"
          /* Every one of these rows is below the fold. */
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className="premium-hover relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-card transition-[transform,border-color,box-shadow] duration-normal ease-out motion-reduce:transition-none"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
      <div className="flex h-full items-center justify-center">
        <section.icon className="size-16 text-primary/30" aria-hidden />
      </div>
      {/* skeleton overlay — deliberately data-free */}
      <div className="absolute inset-x-5 bottom-5 space-y-2">
        <span className="block h-2 w-1/2 rounded-full bg-muted" />
        <span className="block h-2 w-2/3 rounded-full bg-muted/70" />
        <span className="block h-2 w-1/3 rounded-full bg-muted/50" />
      </div>
    </div>
  );
}

export function ProductSections() {
  return (
    <div id="product" className="scroll-mt-20">
      {SECTIONS.map((s, i) => {
        const reversed = i % 2 === 1;
        return (
          <section key={s.id} id={s.id} className="scroll-mt-20 border-t border-border/50">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2">
              <Reveal className={reversed ? 'lg:order-2' : ''}>
                <p className="text-sm font-medium text-primary">{s.eyebrow}</p>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {s.title}
                </h2>
                <p className="mt-4 text-muted-foreground">{s.body}</p>
                <ul className="mt-6 space-y-2.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>

              {/*
               * lg:order-1 puts the visual first on wide screens for the
               * alternating rows. Below lg the grid is one column and DOM
               * order wins, so the text always comes first on mobile.
               */}
              <Reveal className={reversed ? 'lg:order-1' : ''} y={24}>
                <SectionVisual section={s} />
              </Reveal>
            </div>
          </section>
        );
      })}
    </div>
  );
}

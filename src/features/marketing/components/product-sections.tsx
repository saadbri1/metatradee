import { Check } from 'lucide-react';
import { PRODUCT_SECTIONS } from '../data';
import { Reveal } from '../motion/reveal';

/**
 * Alternating deep-dive sections. Each renders from PRODUCT_SECTIONS; the visual
 * side is an abstract, on-brand motif (no invented numbers) that alternates sides
 * on wide screens. Semantic headings, keyboard-agnostic, reduced-motion safe.
 */
export function ProductSections() {
  return (
    <div id="product" className="scroll-mt-20">
      {PRODUCT_SECTIONS.map((s, i) => {
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

              <Reveal className={reversed ? 'lg:order-1' : ''} y={24}>
                <div
                  aria-hidden
                  className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
                  <div className="flex h-full items-center justify-center">
                    <s.icon className="size-16 text-primary/30" aria-hidden />
                  </div>
                  {/* skeleton overlay — deliberately data-free */}
                  <div className="absolute inset-x-5 bottom-5 space-y-2">
                    <span className="block h-2 w-1/2 rounded-full bg-muted" />
                    <span className="block h-2 w-2/3 rounded-full bg-muted/70" />
                    <span className="block h-2 w-1/3 rounded-full bg-muted/50" />
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        );
      })}
    </div>
  );
}

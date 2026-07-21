import type { CSSProperties } from 'react';
import { HOW_IT_WORKS } from '../data';
import { Reveal } from '../motion/reveal';

/** Numbered narrative that walks through the workflow. Server-rendered; the reveal
 *  class sits directly on each <li> (via the page-level observer) so the <ol>→<li>
 *  relationship stays valid for assistive tech. */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            From raw fills to a measurable edge
          </h2>
          <p className="mt-3 text-muted-foreground">
            Four steps, one source of truth — the same numbers the whole app agrees on.
          </p>
        </div>
      </Reveal>

      <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {HOW_IT_WORKS.map((step, i) => (
          <li
            key={step.n}
            className="reveal premium-hover relative h-full rounded-xl border border-border bg-card p-5 transition-[transform,border-color,box-shadow] duration-normal ease-out motion-reduce:transition-none"
            style={{ '--reveal-delay': `${(i % 4) * 60}ms` } as CSSProperties}
          >
            <span
              aria-hidden
              className="tabular font-display text-3xl font-semibold text-primary/70"
            >
              {step.n}
            </span>
            <h3 className="mt-3 font-medium">{step.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

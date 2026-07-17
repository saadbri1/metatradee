import { Plus } from 'lucide-react';
import { FAQS } from '../data';
import { Reveal } from '../motion/reveal';

/**
 * FAQ using native <details>/<summary> — accessible and keyboard-operable with
 * zero client JS (good for LCP). The matching FAQPage JSON-LD is emitted by the
 * page from the same FAQS source, so structured data never drifts from the copy.
 */
export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:py-28">
      <Reveal>
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
      </Reveal>
      <div className="mt-10 divide-y divide-border rounded-xl border border-border">
        {FAQS.map((f) => (
          <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {f.q}
              <Plus
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                aria-hidden
              />
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

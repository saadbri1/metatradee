import { SUPPORTED_FORMATS } from '../data';

/**
 * Import-format marquee — pure-CSS infinite scroll (globals.css `.marquee-track`),
 * pauses on hover, static under reduced motion. Text-only capability names, not
 * third-party brand logos. The list is duplicated once so the -50% translate loops
 * seamlessly; the duplicate is aria-hidden so SR users hear each format once.
 */
export function FormatMarquee() {
  return (
    <section className="border-y border-border/50 py-8" aria-label="Supported import formats">
      <p className="mb-5 text-center text-xs uppercase tracking-widest text-muted-foreground">
        Bring your history from
      </p>
      <div className="marquee group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee-track flex w-max items-center gap-4 pr-4">
          {[0, 1].map((dup) => (
            <ul
              key={dup}
              className="flex items-center gap-4"
              {...(dup === 1 ? { 'aria-hidden': true } : {})}
            >
              {SUPPORTED_FORMATS.map((f) => (
                <li
                  key={f}
                  className="whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
                >
                  {f}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

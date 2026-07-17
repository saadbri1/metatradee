'use client';

/**
 * Sticky, scroll-linked product showcase. A tall section pins a device stage while
 * scrolling advances a discrete active module — so exactly one panel is ever shown
 * and the stage is NEVER blank. The index is driven by an IntersectionObserver on
 * per-module sentinels (container-agnostic — works with window OR nested scrollers,
 * unlike scroll-position math), so there is no motion library in this component at
 * all. Crossfade + rise are pure CSS (opacity/transform). Under
 * `prefers-reduced-motion` it renders a plain static stack. Panel 0 is active by
 * default, so the copy is server-rendered, crawlable, and readable without JS.
 */
import { useEffect, useRef, useState } from 'react';
import { SHOWCASE, type ShowcaseItem } from '../data';
import { DeviceFrame } from './device-frame';

function PreviewMotif({ accent }: { accent: ShowcaseItem['accent'] }) {
  const line = accent === 'profit' ? 'bg-profit/60' : 'bg-primary/60';
  return (
    <div className="p-5">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-background p-3">
            <span className="block h-1.5 w-8 rounded-full bg-muted" />
            <span
              className={`mt-2.5 block h-3 w-14 rounded ${i === 0 ? line : 'bg-foreground/20'}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background p-4">
        <svg viewBox="0 0 440 120" className="h-28 w-full" role="presentation">
          <polyline
            points="0,104 44,92 88,98 132,70 176,78 220,52 264,60 308,36 352,42 396,22 440,14"
            fill="none"
            stroke={accent === 'profit' ? 'hsl(var(--profit))' : 'hsl(var(--primary))'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function Panel({ item, active }: { item: ShowcaseItem; active: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none"
      style={{
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(16px)',
        pointerEvents: active ? 'auto' : 'none',
      }}
      aria-hidden={!active}
    >
      <div className="grid w-full items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-primary">{item.label}</p>
          <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {item.title}
          </h3>
          <p className="mt-4 max-w-md text-muted-foreground">{item.body}</p>
        </div>
        <DeviceFrame url={`metatradee.app/${item.id}`}>
          <PreviewMotif accent={item.accent} />
        </DeviceFrame>
      </div>
    </div>
  );
}

/** Static fallback (reduced motion): a simple stacked list, no pinning. */
function StaticShowcase() {
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-20">
      {SHOWCASE.map((item) => (
        <div key={item.id} className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-primary">{item.label}</p>
            <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {item.title}
            </h3>
            <p className="mt-4 max-w-md text-muted-foreground">{item.body}</p>
          </div>
          <DeviceFrame url={`metatradee.app/${item.id}`}>
            <PreviewMotif accent={item.accent} />
          </DeviceFrame>
        </div>
      ))}
    </div>
  );
}

export function StickyShowcase() {
  const total = SHOWCASE.length;
  const [active, setActive] = useState(0);
  const [reduce, setReduce] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Drive the active index from the section's own scroll position. Reading
  // getBoundingClientRect on scroll is the most portable signal — it tracks the
  // window scroller and nested/embedded scrollers alike. rAF-throttled + passive,
  // so it costs almost nothing on the main thread.
  useEffect(() => {
    if (reduce) return;
    const el = sectionRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const distance = el.offsetHeight - window.innerHeight;
      if (distance <= 0) return;
      const p = Math.min(1, Math.max(0, -rect.top / distance));
      const idx = Math.min(total - 1, Math.max(0, Math.floor(p * total * 0.999)));
      setActive((prev) => (prev === idx ? prev : idx));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce, total]);

  if (reduce) {
    return (
      <section id="showcase" className="scroll-mt-20 border-t border-border/50">
        <StaticShowcase />
      </section>
    );
  }

  return (
    <section
      id="showcase"
      ref={sectionRef}
      className="relative scroll-mt-20 border-t border-border/50"
      style={{ height: `${total * 100}vh` }}
      aria-label="Product showcase"
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="relative mx-auto h-[70vh] w-full max-w-6xl px-4">
          {SHOWCASE.map((item, i) => (
            <Panel key={item.id} item={item} active={i === active} />
          ))}
        </div>
        {/* step rail — highlights the active module */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2"
        >
          {SHOWCASE.map((item, i) => (
            <span
              key={item.id}
              className={`h-1 rounded-full transition-all duration-300 ${i === active ? 'w-10 bg-primary' : 'w-8 bg-border'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

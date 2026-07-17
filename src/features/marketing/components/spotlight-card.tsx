'use client';

/**
 * Cursor-spotlight wrapper. Sets `--mx`/`--my` CSS custom properties from the
 * pointer; the glow itself is pure CSS (globals.css `.spotlight`) and only shows
 * under `hover: hover` + `pointer: fine` + no-reduced-motion. Tiny: one
 * pointermove handler, no library, no re-render.
 */
import { useRef, type ReactNode } from 'react';

export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={`spotlight ${className ?? ''}`}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        el.style.setProperty('--my', `${e.clientY - rect.top}px`);
      }}
    >
      {children}
    </div>
  );
}

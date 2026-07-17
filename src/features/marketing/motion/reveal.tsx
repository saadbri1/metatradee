import type { CSSProperties, ReactNode } from 'react';

/**
 * Scroll-reveal wrapper — a PLAIN SERVER COMPONENT. It only emits static markup
 * (`<div class="reveal">` + CSS custom props); a single page-level
 * `<RevealObserver/>` client island toggles `.is-visible` for every reveal at
 * once. That keeps per-section hydration at zero (minimal Lighthouse TBT). The
 * animation is pure CSS (globals.css) and disabled under `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  /** seconds */
  delay?: number;
  /** px translate */
  y?: number;
  className?: string;
}) {
  const style = {
    '--reveal-delay': `${delay * 1000}ms`,
    '--reveal-y': `${y}px`,
  } as CSSProperties;
  return (
    <div className={['reveal', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

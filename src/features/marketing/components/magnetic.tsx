'use client';

/**
 * Magnetic pointer-follow for the primary CTA. Desktop pointer-fine only and
 * disabled under reduced motion — it degrades to a plain wrapper. Transform-only
 * (GPU), no library, no state churn (writes transform directly on pointermove).
 */
import { useEffect, useRef, type ReactNode } from 'react';

export function Magnetic({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduce.matches) return;

    const strength = 0.3;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate3d(${x * strength}px, ${y * strength}px, 0)`;
    };
    const reset = () => {
      el.style.transform = 'translate3d(0,0,0)';
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ transition: 'transform 0.2s ease-out', willChange: 'transform' }}
    >
      {children}
    </div>
  );
}

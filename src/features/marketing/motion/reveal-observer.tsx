'use client';

/**
 * The single client island that drives every `.reveal` on the page. One
 * IntersectionObserver watches all reveal elements and adds `.is-visible` as they
 * enter the viewport — so the marketing page ships one tiny effect instead of one
 * client component per animated block. Reduced-motion is handled in CSS (the
 * hidden state only exists under `prefers-reduced-motion: no-preference`), so this
 * is a no-op for those users.
 */
import { useEffect } from 'react';

export function RevealObserver() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)'));
    if (els.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -80px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}

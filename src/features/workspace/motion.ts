/**
 * Onboarding motion system (Phase 12.2) — the single numeric source of truth.
 *
 * These values mirror the semantic motion tokens added to `tailwind.config.ts`
 * (`duration-fast|normal|deliberate`, `ease-standard|emphasized`) so CSS-driven
 * and JS-driven motion cannot drift apart. Pure data — no React, no imports —
 * so it is trivially testable and carries no client-bundle cost of its own.
 *
 * Scope is deliberately the onboarding wizard. The authenticated app at large
 * stays CSS-only; we do not animate the whole product.
 */

/** Semantic durations in seconds (Framer's unit). */
export const DURATION = {
  instant: 0,
  fast: 0.12,
  normal: 0.22,
  deliberate: 0.32,
} as const;

/** Shared easing curves, matching the Tailwind timing-function tokens. */
export const EASE = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.22, 1, 0.36, 1],
} as const;

/** Springs for selection/press feedback — gentle, never bouncy. */
export const SPRING = {
  gentle: { type: 'spring', stiffness: 260, damping: 30, mass: 0.6 },
  selection: { type: 'spring', stiffness: 420, damping: 34, mass: 0.5 },
} as const;

/** Horizontal travel for step transitions. Kept inside the 16–24px band. */
export const STEP_TRAVEL_PX = 20;

export type StepDirection = 1 | -1;

export interface StepVariantState {
  x: number;
  opacity: number;
}

/**
 * Direction-aware step variants.
 *
 * `direction` is +1 moving forward and -1 moving back, so a step always enters
 * from the side the user is travelling toward and exits the opposite way —
 * motion that explains where you came from rather than decorating.
 *
 * Under reduced motion every state collapses to the final position with no
 * translation and no fade: an immediate state change, not a faster animation.
 */
export function stepVariants(direction: StepDirection, reduced: boolean) {
  const travel = reduced ? 0 : STEP_TRAVEL_PX;
  // `|| 0` normalizes signed zero: `-1 * 0` is `-0`, which would serialize as
  // `translateX(-0px)`. Harmless to render, but we keep the values clean.
  const offset = (sign: number) => sign * travel || 0;
  return {
    enter: { x: offset(direction), opacity: reduced ? 1 : 0 },
    center: { x: 0, opacity: 1 },
    // The exit transition lives ON the variant — Framer has no `exitTransition`
    // prop. Exit is shorter than enter so the handoff reads as a crossfade.
    exit: {
      x: offset(-direction),
      opacity: reduced ? 1 : 0,
      transition: stepExitTransition(reduced),
    },
  };
}

/** Transition config for a step change. Reduced motion → instant. */
export function stepTransition(reduced: boolean) {
  return reduced
    ? { duration: DURATION.instant }
    : { duration: DURATION.normal, ease: EASE.emphasized };
}

/** Exit is deliberately shorter than enter so `mode="wait"` reads as a
 *  crossfade rather than a blank gap between steps. */
export function stepExitTransition(reduced: boolean) {
  return reduced
    ? { duration: DURATION.instant }
    : { duration: DURATION.fast, ease: EASE.standard };
}

/** Human announcement for the polite live region. */
export function stepAnnouncement(index: number, total: number, title: string): string {
  return `Step ${index + 1} of ${total}: ${title}`;
}

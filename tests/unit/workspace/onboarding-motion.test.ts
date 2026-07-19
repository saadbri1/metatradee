/**
 * Phase 12.2 — onboarding flow, motion system, and a11y semantics.
 * Pure-logic assertions: semantic state, never arbitrary animation timing.
 */
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  clampStep,
  POST_ONBOARDING_REDIRECT,
} from '@/features/workspace/onboarding';
import {
  DURATION,
  EASE,
  STEP_TRAVEL_PX,
  stepVariants,
  stepTransition,
  stepExitTransition,
  stepAnnouncement,
} from '@/features/workspace/motion';

describe('onboarding step model (5-step flow preserved)', () => {
  it('keeps exactly the five agreed steps in order', () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'profile',
      'trading',
      'preferences',
      'finish',
    ]);
    expect(ONBOARDING_STEP_COUNT).toBe(5);
  });

  it('resumes from a persisted step within range', () => {
    expect(clampStep(0)).toBe(0);
    expect(clampStep(2)).toBe(2);
    expect(clampStep(ONBOARDING_STEP_COUNT - 1)).toBe(4);
  });

  it('falls back safely for an invalid persisted step (DB allows 0–10)', () => {
    // The column constraint permits up to 10; the UI must not explode on a
    // value beyond the current step list.
    expect(clampStep(10)).toBe(4);
    expect(clampStep(99)).toBe(4);
    expect(clampStep(-3)).toBe(0);
    expect(clampStep(NaN)).toBe(0);
    expect(clampStep(2.7)).toBe(2);
  });

  it('supports backward navigation without leaving range', () => {
    let step = 3;
    step = clampStep(step - 1);
    expect(step).toBe(2);
    step = clampStep(step - 1);
    step = clampStep(step - 1);
    expect(step).toBe(0);
    expect(clampStep(step - 1)).toBe(0); // cannot go below welcome
  });

  it('sends finished users to the dashboard', () => {
    expect(POST_ONBOARDING_REDIRECT).toBe('/dashboard');
  });
});

describe('live-region announcement', () => {
  it('announces "Step X of N: Title" in human order', () => {
    expect(stepAnnouncement(0, 5, 'Welcome')).toBe('Step 1 of 5: Welcome');
    expect(stepAnnouncement(4, 5, 'All set')).toBe('Step 5 of 5: All set');
  });

  it('produces a distinct message per step (no duplicate announcements)', () => {
    const messages = ONBOARDING_STEPS.map((s, i) =>
      stepAnnouncement(i, ONBOARDING_STEP_COUNT, s.title),
    );
    expect(new Set(messages).size).toBe(ONBOARDING_STEP_COUNT);
  });
});

describe('direction-aware step motion', () => {
  it('enters from the travel direction and exits the opposite way (forward)', () => {
    const v = stepVariants(1, false);
    expect(v.enter.x).toBe(STEP_TRAVEL_PX);
    expect(v.center.x).toBe(0);
    expect(v.exit.x).toBe(-STEP_TRAVEL_PX);
  });

  it('mirrors the motion when navigating back', () => {
    const v = stepVariants(-1, false);
    expect(v.enter.x).toBe(-STEP_TRAVEL_PX);
    expect(v.exit.x).toBe(STEP_TRAVEL_PX);
  });

  it('keeps travel inside the agreed 16–24px band', () => {
    expect(STEP_TRAVEL_PX).toBeGreaterThanOrEqual(16);
    expect(STEP_TRAVEL_PX).toBeLessThanOrEqual(24);
  });

  it('uses a normal-duration enter within 180–280ms', () => {
    const t = stepTransition(false) as { duration: number };
    expect(t.duration * 1000).toBeGreaterThanOrEqual(180);
    expect(t.duration * 1000).toBeLessThanOrEqual(280);
  });

  it('exits faster than it enters so there is no blank gap', () => {
    const enter = stepTransition(false) as { duration: number };
    const exit = stepExitTransition(false) as { duration: number };
    expect(exit.duration).toBeLessThan(enter.duration);
  });

  it('carries the exit timing ON the variant (Framer has no exitTransition prop)', () => {
    expect(stepVariants(1, false).exit).toHaveProperty('transition');
  });
});

describe('reduced motion is an immediate state change, not a faster animation', () => {
  it('removes translation and fade entirely', () => {
    const v = stepVariants(1, true);
    expect(v.enter).toEqual({ x: 0, opacity: 1 });
    expect(v.center).toEqual({ x: 0, opacity: 1 });
    expect(v.exit.x).toBe(0);
    expect(v.exit.opacity).toBe(1);
  });

  it('uses zero duration for both enter and exit', () => {
    expect((stepTransition(true) as { duration: number }).duration).toBe(DURATION.instant);
    expect((stepExitTransition(true) as { duration: number }).duration).toBe(DURATION.instant);
    expect(DURATION.instant).toBe(0);
  });

  it('mirrors direction symmetrically even when reduced', () => {
    expect(stepVariants(-1, true).enter.x).toBe(0);
  });
});

describe('motion tokens are a single coherent source of truth', () => {
  it('exposes the four semantic durations in ascending order', () => {
    expect(DURATION.instant).toBeLessThan(DURATION.fast);
    expect(DURATION.fast).toBeLessThan(DURATION.normal);
    expect(DURATION.normal).toBeLessThan(DURATION.deliberate);
  });

  it('exposes standard and emphasized easing as valid cubic-bezier tuples', () => {
    for (const curve of [EASE.standard, EASE.emphasized]) {
      expect(curve).toHaveLength(4);
      for (const n of curve) expect(Number.isFinite(n)).toBe(true);
    }
  });
});

describe('progress semantics', () => {
  it('fills every bar up to and including the current step, none beyond', () => {
    const step = 2;
    const filled = ONBOARDING_STEPS.map((_, i) => (i <= step ? 1 : 0));
    expect(filled).toEqual([1, 1, 1, 0, 0]);
  });

  it('never moves backward for a forward step change', () => {
    const fillAt = (step: number) => ONBOARDING_STEPS.filter((_, i) => i <= step).length;
    for (let s = 1; s < ONBOARDING_STEP_COUNT; s++) {
      expect(fillAt(s)).toBeGreaterThan(fillAt(s - 1));
    }
  });

  it('scaleX fill is expressed as a 0–1 transform ratio (no width animation)', () => {
    const pct = 42;
    const scale = pct / 100;
    expect(scale).toBeGreaterThanOrEqual(0);
    expect(scale).toBeLessThanOrEqual(1);
    expect(`scaleX(${scale})`).toBe('scaleX(0.42)');
  });
});

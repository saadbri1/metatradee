/**
 * Onboarding wizard definition — pure. Step order + metadata drive the wizard
 * and the server-persisted `profiles.onboarding_step` (index into this list).
 */
export const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'A quick tour before you start.' },
  { id: 'profile', title: 'Your profile', description: 'How you show up in MetaTradee.' },
  {
    id: 'trading',
    title: 'Trading profile',
    description: 'Helps tailor analytics later.',
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Formatting and appearance.',
  },
  { id: 'finish', title: 'All set', description: 'Finish and jump in.' },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];
export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

/** Clamp an arbitrary stored step index into range. */
export function clampStep(step: number): number {
  if (Number.isNaN(step)) return 0;
  return Math.min(Math.max(Math.trunc(step), 0), ONBOARDING_STEP_COUNT - 1);
}

/** Route users land on after finishing/skipping onboarding (the dashboard). */
export const POST_ONBOARDING_REDIRECT = '/dashboard';

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { LazyMotion, domAnimation, AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  clampStep,
  POST_ONBOARDING_REDIRECT,
} from '../onboarding';
import { stepVariants, stepTransition, stepAnnouncement, type StepDirection } from '../motion';
import { useSetOnboardingStep, useCompleteOnboarding } from '../hooks/use-workspace-mutations';
import type { ProfileInput, TradingProfileInput, PreferencesInput } from '../schemas';
import { ProfileForm } from './profile-form';
import { TradingProfileForm } from './trading-profile-form';
import { PreferencesForm } from './preferences-form';

export function OnboardingWizard({
  initialStep = 0,
  profileDefaults,
  tradingDefaults,
  preferencesDefaults,
  avatarUrl,
}: {
  initialStep?: number;
  profileDefaults?: Partial<ProfileInput>;
  tradingDefaults?: Partial<TradingProfileInput>;
  preferencesDefaults?: Partial<PreferencesInput>;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const setStep = useSetOnboardingStep();
  const complete = useCompleteOnboarding();
  const reduced = useReducedMotion() ?? false;

  const [step, setStepIndex] = useState(clampStep(initialStep));
  const [direction, setDirection] = useState<StepDirection>(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Skip the focus move on first paint so landing/resuming never yanks focus.
  const mountedRef = useRef(false);

  const goTo = useCallback(
    (nextIndex: number) => {
      const clamped = clampStep(nextIndex);
      setDirection(clamped >= step ? 1 : -1);
      setStepIndex(clamped);
      setStep.mutate(clamped); // persist so refresh/leave resumes here
    },
    [setStep, step],
  );

  const next = useCallback(() => goTo(step + 1), [goTo, step]);
  const back = useCallback(() => goTo(step - 1), [goTo, step]);

  const skip = useCallback(() => {
    router.replace(POST_ONBOARDING_REDIRECT);
  }, [router]);

  // Guard against a double-fire: the button is disabled while pending, and this
  // ref blocks a second call that slips through (double-click, Enter + click).
  // The server action is idempotent, so a duplicate is safe — this simply
  // avoids a redundant round trip. Success is only acted on AFTER the server
  // confirms; nothing is optimistically shown as complete.
  const finishingRef = useRef(false);
  const finish = useCallback(() => {
    if (finishingRef.current || complete.isPending) return;
    finishingRef.current = true;
    complete.mutate(undefined, {
      onSuccess: () => {
        router.replace(POST_ONBOARDING_REDIRECT);
        router.refresh();
      },
      // Re-arm on failure so the user can retry from an actionable state.
      onError: () => {
        finishingRef.current = false;
      },
    });
  }, [complete, router]);

  const current = ONBOARDING_STEPS[step]!;
  const isLast = step === ONBOARDING_STEP_COUNT - 1;

  /**
   * Move focus to the new step heading after a transition so keyboard and
   * screen-reader users follow the change. `preventScroll` keeps the shell
   * visually stable (no jump). Under reduced motion this runs immediately;
   * otherwise it waits for the enter animation so focus doesn't land mid-move.
   */
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const focusHeading = () => headingRef.current?.focus({ preventScroll: true });
    if (reduced) {
      focusHeading();
      return;
    }
    const timer = window.setTimeout(focusHeading, 240);
    return () => window.clearTimeout(timer);
  }, [step, reduced]);

  return (
    <LazyMotion features={domAnimation} strict>
      <Card className="w-full max-w-2xl">
        {/*
          Polite live region. Rendered once and keyed by step content only, so a
          re-render at the same step does not re-announce.
        */}
        <p aria-live="polite" className="sr-only">
          {stepAnnouncement(step, ONBOARDING_STEP_COUNT, current.title)}
        </p>

        <CardHeader className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step {step + 1} of {ONBOARDING_STEP_COUNT}
            </p>
            {/*
              A real <h1> per step. `CardTitle` renders a <div>, so it is NOT
              used here — changing it globally would alter every other surface.
              The visual classes are preserved exactly.
            */}
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-2xl font-semibold leading-none tracking-tight outline-none"
            >
              {current.title}
            </h1>
            <CardDescription className="mt-1.5">{current.description}</CardDescription>
          </div>
          <ol className="flex gap-1.5" aria-label="Onboarding progress">
            {ONBOARDING_STEPS.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === step ? 'step' : undefined}
                className={cn(
                  'h-1.5 flex-1 overflow-hidden rounded-full bg-muted',
                  'motion-reduce:transition-none',
                )}
              >
                {/*
                  Transform-based fill (scaleX) rather than an animated width —
                  compositor-only, so the progress bar never triggers layout.
                */}
                <span
                  className="block h-full origin-left rounded-full bg-primary transition-transform duration-normal ease-standard motion-reduce:transition-none"
                  style={{ transform: `scaleX(${i <= step ? 1 : 0})` }}
                />
              </li>
            ))}
          </ol>
        </CardHeader>

        <CardContent>
          {/*
            `mode="wait"` keeps a single step mounted at a time, which is the
            stable choice here because the steps differ a lot in height —
            overlapping them would shift the shell. The exit is deliberately
            shorter than the enter so the handoff reads as a crossfade, not a
            blank gap, and rapid/interrupted navigation stays predictable.
          */}
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <m.div
              key={current.id}
              custom={direction}
              variants={stepVariants(direction, reduced)}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition(reduced)}
              className="space-y-6"
            >
              {current.id === 'welcome' ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Let&apos;s set up your workspace. You can skip and finish this later — nothing
                    is locked in.
                  </p>
                  <div className="flex justify-between">
                    <Button type="button" variant="ghost" onClick={skip}>
                      Skip for now
                    </Button>
                    <Button type="button" onClick={next}>
                      Get started <ArrowRight aria-hidden />
                    </Button>
                  </div>
                </div>
              ) : null}

              {current.id === 'profile' ? (
                <div className="space-y-4">
                  <ProfileForm
                    defaultValues={profileDefaults}
                    avatarUrl={avatarUrl}
                    submitLabel="Save & continue"
                    onSaved={next}
                  />
                  <StepNav onBack={back} onSkip={skip} />
                </div>
              ) : null}

              {current.id === 'trading' ? (
                <div className="space-y-4">
                  <TradingProfileForm
                    defaultValues={tradingDefaults}
                    submitLabel="Save & continue"
                    onSaved={next}
                  />
                  <StepNav onBack={back} onSkip={skip} />
                </div>
              ) : null}

              {current.id === 'preferences' ? (
                <div className="space-y-4">
                  <PreferencesForm
                    defaultValues={preferencesDefaults}
                    submitLabel="Save & continue"
                    onSaved={next}
                  />
                  <StepNav onBack={back} onSkip={skip} />
                </div>
              ) : null}

              {current.id === 'finish' || isLast ? (
                <div className="space-y-4 text-center">
                  <Rocket className="mx-auto size-10 text-primary" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    You&apos;re all set. Jump into MetaTradee.
                  </p>
                  {complete.isError ? (
                    <p role="alert" className="text-sm text-destructive">
                      We couldn&apos;t finish setting up your workspace. Please try again.
                    </p>
                  ) : null}
                  <div className="flex justify-between">
                    <Button type="button" variant="ghost" onClick={back}>
                      <ArrowLeft aria-hidden /> Back
                    </Button>
                    <Button
                      type="button"
                      onClick={finish}
                      disabled={complete.isPending}
                      aria-busy={complete.isPending}
                      // Fixed width so the label change cannot shift layout.
                      className="min-w-[7.5rem]"
                    >
                      {complete.isPending ? 'Finishing…' : 'Finish'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </m.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </LazyMotion>
  );
}

function StepNav({ onBack, onSkip }: { onBack: () => void; onSkip: () => void }) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft aria-hidden /> Back
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
        Skip for now
      </Button>
    </div>
  );
}

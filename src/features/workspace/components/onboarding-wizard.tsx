'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  clampStep,
  POST_ONBOARDING_REDIRECT,
} from '../onboarding';
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
  const [step, setStepIndex] = useState(clampStep(initialStep));

  const goTo = useCallback(
    (next: number) => {
      const clamped = clampStep(next);
      setStepIndex(clamped);
      setStep.mutate(clamped); // persist so refresh/leave resumes here
    },
    [setStep],
  );

  const next = useCallback(() => goTo(step + 1), [goTo, step]);
  const back = useCallback(() => goTo(step - 1), [goTo, step]);

  const skip = useCallback(() => {
    router.replace(POST_ONBOARDING_REDIRECT);
  }, [router]);

  const finish = useCallback(() => {
    complete.mutate(undefined, {
      onSuccess: () => {
        router.replace(POST_ONBOARDING_REDIRECT);
        router.refresh();
      },
    });
  }, [complete, router]);

  const current = ONBOARDING_STEPS[step]!;
  const isLast = step === ONBOARDING_STEP_COUNT - 1;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Step {step + 1} of {ONBOARDING_STEP_COUNT}
          </p>
          <CardTitle className="font-display text-2xl tracking-tight">{current.title}</CardTitle>
          <CardDescription>{current.description}</CardDescription>
        </div>
        <ol className="flex gap-1.5" aria-label="Onboarding progress">
          {ONBOARDING_STEPS.map((s, i) => (
            <li
              key={s.id}
              aria-current={i === step ? 'step' : undefined}
              className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </ol>
      </CardHeader>

      <CardContent className="space-y-6">
        {current.id === 'welcome' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Let&apos;s set up your workspace. You can skip and finish this later — nothing is
              locked in.
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
            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={back}>
                <ArrowLeft aria-hidden /> Back
              </Button>
              <Button
                type="button"
                onClick={finish}
                disabled={complete.isPending}
                aria-busy={complete.isPending}
              >
                {complete.isPending ? 'Finishing…' : 'Finish'}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
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

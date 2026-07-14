'use client';

import { useMutation } from '@tanstack/react-query';
import {
  updateProfileAction,
  updatePreferencesAction,
  saveTradingProfileAction,
  checkUsernameAction,
  setOnboardingStepAction,
  completeOnboardingAction,
} from '../server/actions';
import type { ProfileInput, PreferencesInput, TradingProfileInput } from '../schemas';
import type { ActionResult, UsernameAvailability } from '../types';

export function useUpdateProfile() {
  return useMutation<ActionResult, Error, ProfileInput>({
    mutationFn: (input) => updateProfileAction(input),
  });
}

export function useUpdatePreferences() {
  return useMutation<ActionResult, Error, PreferencesInput>({
    mutationFn: (input) => updatePreferencesAction(input),
  });
}

export function useSaveTradingProfile() {
  return useMutation<ActionResult, Error, TradingProfileInput>({
    mutationFn: (input) => saveTradingProfileAction(input),
  });
}

export function useUsernameCheck() {
  return useMutation<UsernameAvailability, Error, string>({
    mutationFn: (username) => checkUsernameAction({ username }),
  });
}

export function useSetOnboardingStep() {
  return useMutation<ActionResult, Error, number>({
    mutationFn: (step) => setOnboardingStepAction({ step }),
  });
}

export function useCompleteOnboarding() {
  return useMutation<ActionResult, Error, void>({
    mutationFn: () => completeOnboardingAction(),
  });
}

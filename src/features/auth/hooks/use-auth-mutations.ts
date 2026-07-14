'use client';

/**
 * TanStack Query mutation wrappers around the auth server actions. Components
 * consume these for loading/error/success state; no auth state is duplicated in
 * a client store (Supabase + the server session own it).
 */
import { useMutation } from '@tanstack/react-query';
import {
  signInAction,
  signUpAction,
  requestPasswordResetAction,
  resetPasswordAction,
  resendVerificationAction,
} from '../server/actions';
import type {
  SignInInput,
  SignUpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ResendVerificationInput,
} from '../schemas';
import type { AuthActionResult } from '../types';

export function useSignIn(next?: string) {
  return useMutation<AuthActionResult, Error, SignInInput>({
    mutationFn: (input) => signInAction(input, next),
  });
}

export function useSignUp(next?: string) {
  return useMutation<AuthActionResult, Error, SignUpInput>({
    mutationFn: (input) => signUpAction(input, next),
  });
}

export function useRequestPasswordReset() {
  return useMutation<AuthActionResult, Error, ForgotPasswordInput>({
    mutationFn: (input) => requestPasswordResetAction(input),
  });
}

export function useResetPassword() {
  return useMutation<AuthActionResult, Error, ResetPasswordInput>({
    mutationFn: (input) => resetPasswordAction(input),
  });
}

export function useResendVerification() {
  return useMutation<AuthActionResult, Error, ResendVerificationInput>({
    mutationFn: (input) => resendVerificationAction(input),
  });
}

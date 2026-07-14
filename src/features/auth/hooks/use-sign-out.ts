'use client';

/**
 * Sign-out hooks. `useSignOut` ends the current session; `useSignOutEverywhere`
 * revokes every session for the user (exposed even though UI is minimal, per the
 * session-management requirement).
 */
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { signOutAction, signOutEverywhereAction } from '../server/actions';
import { AUTH_ROUTES } from '../config';
import type { AuthActionResult } from '../types';

export function useSignOut() {
  const router = useRouter();
  return useMutation<AuthActionResult, Error, void>({
    mutationFn: () => signOutAction(),
    onSuccess: (result) => {
      router.replace(result.ok && result.redirectTo ? result.redirectTo : AUTH_ROUTES.login);
      router.refresh();
    },
  });
}

export function useSignOutEverywhere() {
  const router = useRouter();
  return useMutation<AuthActionResult, Error, void>({
    mutationFn: () => signOutEverywhereAction(),
    onSuccess: (result) => {
      router.replace(result.ok && result.redirectTo ? result.redirectTo : AUTH_ROUTES.login);
      router.refresh();
    },
  });
}

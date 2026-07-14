'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  enrollMfaAction,
  verifyMfaAction,
  unenrollMfaAction,
  getMfaStateAction,
} from './server/mfa-actions';
import type { MfaResolution } from './mfa';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function useMfaState() {
  return useQuery<MfaResolution | null>({
    queryKey: ['mfa', 'state'],
    queryFn: () => getMfaStateAction(),
    staleTime: 30_000,
  });
}

export function useEnrollMfa() {
  return useMutation<ActionResult<{ factorId: string; qr: string; secret: string }>, Error, void>({
    mutationFn: () => enrollMfaAction(),
  });
}

export function useVerifyMfa() {
  const qc = useQueryClient();
  return useMutation<ActionResult, Error, { factorId: string; code: string }>({
    mutationFn: (input) => verifyMfaAction(input),
    onSuccess: (r) => r.ok && qc.invalidateQueries({ queryKey: ['mfa'] }),
  });
}

export function useUnenrollMfa() {
  const qc = useQueryClient();
  return useMutation<ActionResult, Error, string>({
    mutationFn: (factorId) => unenrollMfaAction(factorId),
    onSuccess: (r) => r.ok && qc.invalidateQueries({ queryKey: ['mfa'] }),
  });
}

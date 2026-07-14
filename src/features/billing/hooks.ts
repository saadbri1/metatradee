'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getBillingOverviewAction,
  getEntitlementAction,
  createCheckoutAction,
  createPortalAction,
  type BillingOverview,
} from './server/actions';
import type { CheckoutInput } from './schemas';
import type { Entitlement } from './types';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function useBillingOverview() {
  return useQuery<BillingOverview | null>({
    queryKey: ['billing', 'overview'],
    queryFn: () => getBillingOverviewAction(),
    staleTime: 60_000,
  });
}

/** Read-only capability flags. The client reflects access, never decides it. */
export function useEntitlement() {
  return useQuery<Entitlement | null>({
    queryKey: ['billing', 'entitlement'],
    queryFn: () => getEntitlementAction(),
    staleTime: 60_000,
  });
}

export function useCheckout() {
  return useMutation<ActionResult<{ url: string }>, Error, CheckoutInput>({
    mutationFn: (input) => createCheckoutAction(input),
    onSuccess: (r) => {
      if (r.ok && r.data) window.location.href = r.data.url;
    },
  });
}

export function useOpenPortal() {
  return useMutation<ActionResult<{ url: string }>, Error, void>({
    mutationFn: () => createPortalAction(),
    onSuccess: (r) => {
      if (r.ok && r.data) window.location.href = r.data.url;
    },
  });
}

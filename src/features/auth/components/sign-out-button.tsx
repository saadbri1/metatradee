'use client';

import { useSignOut } from '../hooks/use-sign-out';
import { SubmitButton } from './submit-button';

/** Minimal logout control. `useSignOutEverywhere` is also available for a
 *  "sign out of all devices" action when that UI is built. */
export function SignOutButton() {
  const signOut = useSignOut();
  return (
    <SubmitButton
      type="button"
      variant="ghost"
      size="sm"
      loading={signOut.isPending}
      loadingText="Signing out…"
      onClick={() => signOut.mutate()}
    >
      Sign out
    </SubmitButton>
  );
}

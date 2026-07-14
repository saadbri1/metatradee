'use client';

import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

interface SubmitButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
  /** When set, the button is disabled and this explains why (a11y + tooltip). */
  disabledReason?: string;
}

/**
 * Submit button with loading and disabled-with-reason states. Communicates busy
 * state to assistive tech via `aria-busy`, and the disabled reason via `title`
 * + `aria-label` so it isn't a silently dead control.
 */
export function SubmitButton({
  loading = false,
  loadingText,
  disabledReason,
  disabled,
  children,
  type = 'submit',
  ...props
}: SubmitButtonProps) {
  const isDisabled = disabled || loading || Boolean(disabledReason);
  return (
    <Button
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      aria-disabled={isDisabled}
      title={disabledReason}
      aria-label={disabledReason ? `${String(children)} — ${disabledReason}` : undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

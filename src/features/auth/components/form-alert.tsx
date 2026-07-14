import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FormAlertProps {
  tone: 'error' | 'success';
  children: React.ReactNode;
}

/**
 * Form-level status message. Errors use the destructive token and announce
 * assertively; success announces politely. Both are live regions so screen
 * readers hear the result of a submit.
 */
export function FormAlert({ tone, children }: FormAlertProps) {
  const isError = tone === 'error';
  return (
    <Alert
      variant={isError ? 'destructive' : 'default'}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {isError ? (
        <AlertCircle className="size-4" aria-hidden />
      ) : (
        <CheckCircle2 className="size-4" aria-hidden />
      )}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { AUTH_ROUTES } from '@/features/auth/config';

export const metadata: Metadata = { title: 'Set a new password' };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      description="Choose a strong password you don't use elsewhere."
      footer={
        <Link href={AUTH_ROUTES.login} className="text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}

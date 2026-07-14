import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { AUTH_ROUTES } from '@/features/auth/config';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we'll send you a reset link."
      footer={
        <Link href={AUTH_ROUTES.login} className="text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}

import type { Metadata } from 'next';
import { MfaSettings } from '@/features/auth/enterprise/components/mfa-settings';

export const metadata: Metadata = { title: 'Security' };

export default function SecuritySettingsPage() {
  return <MfaSettings />;
}

import type { Metadata } from 'next';
import { ProfileForm } from '@/features/workspace/components/profile-form';
import { getProfile } from '@/features/workspace/server/queries';
import type { ProfileInput } from '@/features/workspace/schemas';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfileSettingsPage() {
  const profile = await getProfile();
  const defaults: Partial<ProfileInput> = {
    display_name: profile?.display_name ?? '',
    username: profile?.username ?? '',
    bio: profile?.bio ?? '',
    country: profile?.country ?? '',
    timezone: profile?.timezone ?? '',
    preferred_language: profile?.preferred_language ?? '',
  };
  return <ProfileForm defaultValues={defaults} avatarUrl={profile?.avatar_url ?? null} />;
}

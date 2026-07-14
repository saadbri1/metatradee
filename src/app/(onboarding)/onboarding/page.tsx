import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/features/workspace/components/onboarding-wizard';
import { POST_ONBOARDING_REDIRECT } from '@/features/workspace/onboarding';
import { getProfile, getTradingProfile, getPreferences } from '@/features/workspace/server/queries';
import type {
  ProfileInput,
  TradingProfileInput,
  PreferencesInput,
} from '@/features/workspace/schemas';

export const metadata: Metadata = { title: 'Welcome' };

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (profile?.onboarding_completed) redirect(POST_ONBOARDING_REDIRECT);

  const [trading, preferences] = await Promise.all([getTradingProfile(), getPreferences()]);

  const profileDefaults: Partial<ProfileInput> = {
    display_name: profile?.display_name ?? '',
    username: profile?.username ?? '',
    bio: profile?.bio ?? '',
    country: profile?.country ?? '',
    timezone: profile?.timezone ?? '',
    preferred_language: profile?.preferred_language ?? '',
  };

  return (
    <OnboardingWizard
      initialStep={profile?.onboarding_step ?? 0}
      avatarUrl={profile?.avatar_url ?? null}
      profileDefaults={profileDefaults}
      tradingDefaults={trading ? (trading as unknown as Partial<TradingProfileInput>) : undefined}
      preferencesDefaults={
        preferences ? (preferences as unknown as Partial<PreferencesInput>) : undefined
      }
    />
  );
}

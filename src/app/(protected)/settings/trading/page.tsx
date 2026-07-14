import type { Metadata } from 'next';
import { TradingProfileForm } from '@/features/workspace/components/trading-profile-form';
import { getTradingProfile } from '@/features/workspace/server/queries';
import type { TradingProfileInput } from '@/features/workspace/schemas';

export const metadata: Metadata = { title: 'Trading profile' };

export default async function TradingSettingsPage() {
  const trading = await getTradingProfile();
  return (
    <TradingProfileForm
      defaultValues={trading ? (trading as unknown as Partial<TradingProfileInput>) : undefined}
    />
  );
}

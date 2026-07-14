import type { Metadata } from 'next';
import { PreferencesForm } from '@/features/workspace/components/preferences-form';
import { getPreferences } from '@/features/workspace/server/queries';
import type { PreferencesInput } from '@/features/workspace/schemas';

export const metadata: Metadata = { title: 'Preferences' };

export default async function PreferencesSettingsPage() {
  const preferences = await getPreferences();
  return (
    <PreferencesForm
      defaultValues={
        preferences ? (preferences as unknown as Partial<PreferencesInput>) : undefined
      }
    />
  );
}

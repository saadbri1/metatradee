/**
 * Server-side reads for the current user's workspace. All queries are RLS-scoped
 * (owner-only) — the DB enforces isolation; these never take a user id from the
 * caller.
 */
import { createClient } from '@/lib/supabase/server';
import { TABLES } from '@/lib/db/tables';
import type { ProfileView } from '../types';

export async function getProfile(): Promise<ProfileView | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from(TABLES.profiles)
    .select(
      'id, display_name, username, bio, country, timezone, preferred_language, avatar_url, onboarding_step, onboarding_completed',
    )
    .eq('id', user.id)
    .maybeSingle();

  return (data as ProfileView | null) ?? null;
}

export async function getPreferences(): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from(TABLES.userPreferences)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return (data as Record<string, unknown> | null) ?? null;
}

export async function getTradingProfile(): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from(TABLES.tradingProfiles)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return (data as Record<string, unknown> | null) ?? null;
}

export async function getOnboardingState(): Promise<{
  step: number;
  completed: boolean;
} | null> {
  const profile = await getProfile();
  if (!profile) return null;
  return {
    step: profile.onboarding_step,
    completed: profile.onboarding_completed,
  };
}

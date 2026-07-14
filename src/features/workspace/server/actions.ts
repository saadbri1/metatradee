'use server';

/**
 * Workspace server actions. Every mutation re-validates with the shared Zod
 * schema (never trust the client) and writes through the RLS-scoped server
 * client, so isolation is enforced by BOTH the guard here and RLS. Important
 * profile changes are audited via the reused 9.2 hook.
 */
import { createClient } from '@/lib/supabase/server';
import { TABLES } from '@/lib/db/tables';
import { AUDIT_EVENTS } from '@/features/auth/config';
import { logAuditEvent } from '@/features/auth/server/audit';
import { validateAvatarFile } from '@/lib/db/avatar';
import {
  profileSchema,
  preferencesSchema,
  tradingProfileSchema,
  usernameCheckSchema,
  onboardingStepSchema,
} from '../schemas';
import { clampStep, ONBOARDING_STEP_COUNT } from '../onboarding';
import { isReservedUsername } from '../lib/username';
import type { ActionResult, UsernameAvailability } from '../types';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function fieldErrorResult(errors: Record<string, string[] | undefined>): ActionResult {
  return {
    ok: false,
    error: 'Please fix the errors below.',
    fieldErrors: errors as Record<string, string[]>,
  };
}

// --- username availability -------------------------------------------------
export async function checkUsernameAction(input: unknown): Promise<UsernameAvailability> {
  const parsed = usernameCheckSchema.safeParse(input);
  if (!parsed.success) return { available: false, reason: 'invalid' };
  const username = parsed.data.username;
  if (isReservedUsername(username)) return { available: false, reason: 'reserved' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase.from(TABLES.profiles).select('id').eq('username', username);
  if (user) query = query.neq('id', user.id);
  const { data } = await query.maybeSingle();

  return data ? { available: false, reason: 'taken' } : { available: true };
}

// --- profile ---------------------------------------------------------------
export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fieldErrorResult(parsed.error.flatten().fieldErrors);

  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();

  // Server-authoritative username uniqueness (defense beyond the DB unique idx).
  const availability = await checkUsernameAction({ username: parsed.data.username });
  if (!availability.available) {
    return fieldErrorResult({
      username: [
        availability.reason === 'reserved'
          ? 'That username is reserved.'
          : 'That username is taken.',
      ],
    });
  }

  const { data: existing } = await supabase
    .from(TABLES.profiles)
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  const { error } = await supabase
    .from(TABLES.profiles)
    .update({
      display_name: parsed.data.display_name,
      username: parsed.data.username,
      bio: parsed.data.bio || null,
      country: parsed.data.country || null,
      timezone: parsed.data.timezone || null,
      preferred_language: parsed.data.preferred_language || null,
    })
    .eq('id', userId);

  if (error) return { ok: false, error: GENERIC_ERROR };

  await logAuditEvent(AUDIT_EVENTS.profileUpdated, {});
  const previousUsername = (existing as { username?: string } | null)?.username;
  if (previousUsername && previousUsername !== parsed.data.username) {
    await logAuditEvent(AUDIT_EVENTS.usernameChanged, {
      from: previousUsername,
      to: parsed.data.username,
    });
  }
  return { ok: true };
}

// --- preferences (optimistic on the client; authoritative here) ------------
export async function updatePreferencesAction(input: unknown): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return fieldErrorResult(parsed.error.flatten().fieldErrors);

  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.userPreferences)
    .update(parsed.data)
    .eq('user_id', userId);

  if (error) return { ok: false, error: GENERIC_ERROR };
  return { ok: true };
}

// --- trading profile -------------------------------------------------------
export async function saveTradingProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = tradingProfileSchema.safeParse(input);
  if (!parsed.success) return fieldErrorResult(parsed.error.flatten().fieldErrors);

  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.tradingProfiles)
    .upsert({ user_id: userId, ...parsed.data }, { onConflict: 'user_id' });

  if (error) return { ok: false, error: GENERIC_ERROR };
  return { ok: true };
}

// --- onboarding ------------------------------------------------------------
export async function setOnboardingStepAction(input: unknown): Promise<ActionResult> {
  const parsed = onboardingStepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid step.' };

  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.profiles)
    .update({ onboarding_step: clampStep(parsed.data.step) })
    .eq('id', userId);

  if (error) return { ok: false, error: GENERIC_ERROR };
  return { ok: true };
}

export async function completeOnboardingAction(): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.profiles)
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step: ONBOARDING_STEP_COUNT - 1,
    })
    .eq('id', userId);

  if (error) return { ok: false, error: GENERIC_ERROR };
  await logAuditEvent(AUDIT_EVENTS.onboardingCompleted, {});
  return { ok: true };
}

// --- avatar finalize (client uploads to storage; server records + swaps) ---
export async function finalizeAvatarAction(input: {
  path: string;
  mime: string;
  size: number;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };

  // Path must be inside the caller's own folder (never trust client path).
  if (!input.path.startsWith(`${userId}/`)) {
    return { ok: false, error: 'Invalid upload path.' };
  }
  // Authoritative re-validation of type + size (bucket also enforces both).
  const check = validateAvatarFile({ type: input.mime, size: input.size });
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createClient();

  // Replace-old-on-new: soft-delete prior avatar attachments + remove objects.
  const { data: previous } = await supabase
    .from(TABLES.attachments)
    .select('id, path')
    .eq('user_id', userId)
    .eq('kind', 'avatar')
    .is('deleted_at', null);

  const oldPaths =
    (previous as { id: string; path: string }[] | null)
      ?.map((a) => a.path)
      .filter((p) => p !== input.path) ?? [];
  if (oldPaths.length > 0) {
    await supabase.storage.from('avatars').remove(oldPaths);
    await supabase
      .from(TABLES.attachments)
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('kind', 'avatar')
      .in('path', oldPaths);
  }

  const { error: attachErr } = await supabase.from(TABLES.attachments).upsert(
    {
      user_id: userId,
      bucket: 'avatars',
      path: input.path,
      kind: 'avatar',
      mime_type: input.mime,
      size_bytes: input.size,
    },
    { onConflict: 'bucket,path' },
  );
  if (attachErr) return { ok: false, error: GENERIC_ERROR };

  const { error: profileErr } = await supabase
    .from(TABLES.profiles)
    .update({ avatar_url: input.path })
    .eq('id', userId);
  if (profileErr) return { ok: false, error: GENERIC_ERROR };

  await logAuditEvent(AUDIT_EVENTS.avatarChanged, {});
  return { ok: true };
}

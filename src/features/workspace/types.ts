/**
 * Workspace feature types + the shared action-result contract (same shape as the
 * auth phase uses, so client handling is consistent across features).
 */

export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export interface ProfileView {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  country: string | null;
  timezone: string | null;
  preferred_language: string | null;
  avatar_url: string | null;
  onboarding_step: number;
  onboarding_completed: boolean;
}

export interface UsernameAvailability {
  available: boolean;
  reason?: 'reserved' | 'taken' | 'invalid';
}

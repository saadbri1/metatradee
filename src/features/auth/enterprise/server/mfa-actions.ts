'use server';

/**
 * MFA server actions — drive Supabase's native TOTP factors + AAL. The app never
 * stores TOTP secrets; Supabase manages the factor. Enroll returns a QR/secret to
 * display once; verify confirms the factor; the authoritative state is read back
 * from `listFactors()` + AAL. All actions are owner-scoped (the SDK acts on the
 * current session's user) and audited.
 */
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/features/auth/server/audit';
import { AUDIT_EVENTS } from '@/features/auth/config';
import { computeMfaState, DEFAULT_MFA_POLICY, type Aal, type MfaFactor } from '../mfa';
import { resolveEntitlementsFromMetadata } from '../rbac';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Begin TOTP enrollment. Returns the otpauth URI + secret to show once. */
export async function enrollMfaAction(): Promise<
  ActionResult<{ factorId: string; qr: string; secret: string }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not start enrollment.' };
  await logAuditEvent(AUDIT_EVENTS.mfaEnrollStarted, { factorId: data.id });
  return {
    ok: true,
    data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret },
  };
}

/** Verify the enrolling factor with the user's first TOTP code. */
export async function verifyMfaAction(input: {
  factorId: string;
  code: string;
}): Promise<ActionResult> {
  const code = String(input.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Enter the 6-digit code.' };
  const supabase = await createClient();
  const challenge = await supabase.auth.mfa.challenge({ factorId: input.factorId });
  if (challenge.error || !challenge.data) {
    return { ok: false, error: challenge.error?.message ?? 'Could not create a challenge.' };
  }
  const verify = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (verify.error) return { ok: false, error: 'That code was not valid. Try again.' };
  await logAuditEvent(AUDIT_EVENTS.mfaEnrolled, { factorId: input.factorId });
  return { ok: true };
}

/** Remove a TOTP factor (self-serve). */
export async function unenrollMfaAction(factorId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: error.message };
  await logAuditEvent(AUDIT_EVENTS.mfaUnenrolled, { factorId });
  return { ok: true };
}

/**
 * Authoritative MFA state for the current user (async — reads factors + AAL).
 * High-risk server actions call this to decide whether to block.
 */
export async function getMfaStateAction(): Promise<ReturnType<typeof computeMfaState> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const factorsRes = await supabase.auth.mfa.listFactors();
  const factors: MfaFactor[] = (factorsRes.data?.totp ?? []).map((f) => ({
    id: f.id,
    factorType: 'totp',
    status: f.status === 'verified' ? 'verified' : 'unverified',
  }));

  const aalRes = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal: Aal = aalRes.data?.currentLevel === 'aal2' ? 'aal2' : 'aal1';

  const ent = resolveEntitlementsFromMetadata(user.app_metadata as Record<string, unknown>);
  const optedIn = user.app_metadata?.mfa_required === true;
  return computeMfaState(factors, aal, { ...DEFAULT_MFA_POLICY, userOptedIn: optedIn }, ent.role);
}

/**
 * MFA/2FA policy logic (pure, deterministic — unit-tested). The server actions
 * drive Supabase's native TOTP factors + AAL; this module decides enrolled /
 * required / satisfied from that state. FAIL CLOSED: when a policy requires MFA
 * and the session is not AAL2, high-risk actions must be blocked.
 */
import type { Role } from '../types';

export interface MfaFactor {
  id: string;
  factorType: 'totp' | 'phone';
  status: 'verified' | 'unverified';
}

/** Authenticator Assurance Level from the current session. */
export type Aal = 'aal1' | 'aal2';

export interface MfaPolicy {
  /** Force MFA for everyone (enterprise tenant policy). */
  requireForAll: boolean;
  /** Force MFA for these roles (e.g. owner/admin). */
  requireForRoles: readonly Role[];
  /** The user opted in via security settings. */
  userOptedIn: boolean;
}

export interface MfaResolution {
  enrolled: boolean;
  required: boolean;
  satisfied: boolean;
  /** True when the user must complete an MFA challenge to proceed. */
  needsChallenge: boolean;
}

export function isEnrolled(factors: MfaFactor[]): boolean {
  return factors.some((f) => f.status === 'verified');
}

export function isRequired(policy: MfaPolicy, role: Role): boolean {
  return policy.requireForAll || policy.requireForRoles.includes(role) || policy.userOptedIn;
}

/**
 * Compute the full MFA state. `needsChallenge` is the gate: required + enrolled
 * but the session is only AAL1. If required but NOT enrolled, the user must
 * enroll first (surfaced as required && !enrolled).
 */
export function computeMfaState(
  factors: MfaFactor[],
  aal: Aal,
  policy: MfaPolicy,
  role: Role,
): MfaResolution {
  const enrolled = isEnrolled(factors);
  const required = isRequired(policy, role);
  const satisfied = aal === 'aal2';
  return { enrolled, required, satisfied, needsChallenge: required && enrolled && !satisfied };
}

/** Default policy: MFA optional, enforced only when the user opts in. */
export const DEFAULT_MFA_POLICY: MfaPolicy = {
  requireForAll: false,
  requireForRoles: [],
  userOptedIn: false,
};

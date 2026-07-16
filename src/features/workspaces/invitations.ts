/**
 * Invitation logic (pure, tested). Tokens reuse the 10.7 crypto (256-bit
 * CSPRNG). An invite is bound to email + workspace + role, single-use,
 * time-limited, and can never grant a role above the inviter's authority.
 * Validation FAILS CLOSED. No account enumeration: acceptance errors are
 * uniform and never reveal whether an email has an account.
 */
import { canAssignRole, isWorkspaceRole, type WorkspaceRole } from './roles';

export const INVITE_TTL_HOURS = 72;
export const MAX_PENDING_INVITES_PER_WORKSPACE = 25;

export interface InviteRecord {
  email: string;
  workspaceRole: string;
  expiresAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
}

export type InviteVerdict =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'used' | 'revoked' | 'email_mismatch' | 'invalid' };

/** Uniform, fail-closed acceptance check. */
export function validateInvite(
  invite: InviteRecord | null | undefined,
  authedEmail: string | null,
  now: Date = new Date(),
): InviteVerdict {
  if (!invite || !isWorkspaceRole(invite.workspaceRole)) return { ok: false, reason: 'invalid' };
  if (invite.revokedAt) return { ok: false, reason: 'revoked' };
  if (invite.acceptedAt || invite.declinedAt) return { ok: false, reason: 'used' };
  if (new Date(invite.expiresAt).getTime() <= now.getTime())
    return { ok: false, reason: 'expired' };
  if (!authedEmail || authedEmail.trim().toLowerCase() !== invite.email.trim().toLowerCase()) {
    return { ok: false, reason: 'email_mismatch' };
  }
  return { ok: true };
}

/** May `inviterRole` issue an invite for `targetRole`? (No self-escalation.) */
export function canInvite(inviterRole: unknown, targetRole: unknown): boolean {
  return canAssignRole(inviterRole, targetRole);
}

/** Expiry timestamp for a new invite. */
export function inviteExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + INVITE_TTL_HOURS * 3600_000).toISOString();
}

export type { WorkspaceRole };

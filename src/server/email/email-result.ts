/**
 * The result of attempting to send an email.
 *
 * A DISCRIMINATED UNION on purpose. The failure mode this exists to prevent is
 * a boolean `ok` that a caller forgets to check, or a thrown error swallowed
 * into a success toast — either of which shows a user "message sent" when
 * nothing was sent. Every path returns one of these, and `reason` is a closed
 * set so a caller can decide what to tell the user without parsing a string.
 */

export type EmailFailureReason =
  /** No RESEND_API_KEY, or no verified from-address. Operator problem. */
  | 'not_configured'
  /** Resend accepted the request shape but refused it (4xx). */
  | 'rejected'
  /** Network fault or Resend 5xx. Worth retrying. */
  | 'transport_error'
  /** The payload failed validation before any send was attempted. */
  | 'invalid_payload';

export interface EmailSuccess {
  ok: true;
  /** Provider message id, for support to trace a delivery. */
  id: string;
}

export interface EmailFailure {
  ok: false;
  reason: EmailFailureReason;
  /**
   * Safe for a log. NEVER contains the API key, the recipient's message body,
   * or a raw provider response — provider errors can echo submitted content.
   */
  detail: string;
}

export type EmailResult = EmailSuccess | EmailFailure;

export function emailFailure(reason: EmailFailureReason, detail: string): EmailFailure {
  return { ok: false, reason, detail };
}

/**
 * Webhook request-body bounds (Phase 12.1). Pure + tested so the route stays a
 * thin adapter. Real provider events are a few KB; anything larger is abuse or
 * corruption and is rejected BEFORE any HMAC work is spent on it.
 */

/** Maximum accepted webhook body. */
export const MAX_WEBHOOK_BODY_BYTES = 1_048_576; // 1 MB

/**
 * True when the body must be rejected. Accepts the declared `content-length`
 * (may be absent or a lie) and, once read, the actual byte length. Either
 * exceeding the cap rejects, so a missing/forged header cannot bypass the limit.
 */
export function isWebhookBodyTooLarge(
  declaredLength: string | null,
  actualBytes?: number,
): boolean {
  const declared = Number(declaredLength);
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BODY_BYTES) return true;
  if (actualBytes !== undefined && actualBytes > MAX_WEBHOOK_BODY_BYTES) return true;
  return false;
}

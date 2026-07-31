/**
 * PayPal SUBSCRIPTIONS IS RETIRED.
 *
 * MetaTradee bills through one-time PayPal Orders. Subscriptions must not run
 * in parallel: two live payment paths against one entitlement mirror is how a
 * buyer ends up charged twice, or granted access by the path nobody is
 * watching.
 *
 * This is a single constant rather than deleted code because the Orders path is
 * not finished yet. Deleting the modules now would leave the app with no
 * checkout at all AND no record of what the old flow did while the replacement
 * is still being built. So the flow is DISABLED at every entry point — it
 * cannot render, cannot create a subscription, and cannot grant entitlement —
 * and the code stays only as a reference until Orders lands.
 *
 * When the Orders slice is complete, delete:
 *   - this file
 *   - providers/paypal/verify-action.ts
 *   - components/paypal-button.tsx
 *   - providers/paypal/diagnostics.ts  (temporary, from e028eb2)
 *   - the subscription branches in providers/paypal/interpret.ts
 */

/**
 * Hard off. Not an env flag on purpose: a runtime toggle could be flipped by
 * accident and would put both payment paths live simultaneously, which is the
 * exact state this exists to prevent.
 */
export const PAYPAL_SUBSCRIPTIONS_ENABLED = false as const;

/** Copy shown wherever the retired checkout used to be. */
export const SUBSCRIPTIONS_RETIRED_MESSAGE =
  'PayPal subscription checkout has been retired. One-time payments are being introduced in its place.';

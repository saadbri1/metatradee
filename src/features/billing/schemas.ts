/** Shared Zod schemas (client + server) for billing actions. */
import { z } from 'zod';

export const checkoutSchema = z.object({
  tier: z.enum(['trader', 'pro', 'funded']),
  interval: z.enum(['monthly', 'annual']).default('monthly'),
  /** Provider-managed promo/coupon code (validated by the provider, not us). */
  couponCode: z.string().trim().max(64).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

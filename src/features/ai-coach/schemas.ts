/** Shared Zod schemas (client + server) for the AI Coach. */
import { z } from 'zod';

export const reviewScopeSchema = z.enum(['trade', 'daily', 'weekly', 'monthly']);

export const generateReviewSchema = z.object({
  scope: reviewScopeSchema,
  /** Trade uuid (trade scope) or an ISO date / 'YYYY-MM' period key. */
  targetId: z.string().trim().min(1).max(64),
});
export type GenerateReviewInput = z.infer<typeof generateReviewSchema>;

export const feedbackSchema = z.object({
  reviewId: z.string().uuid(),
  insightId: z.string().min(1).max(128),
  verdict: z.enum(['accepted', 'dismissed']),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

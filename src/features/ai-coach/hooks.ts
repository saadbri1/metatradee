'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  generateReviewAction,
  getReviewAction,
  getHistoryAction,
  submitFeedbackAction,
  deleteReviewAction,
} from './server/actions';
import type { FeedbackInput, GenerateReviewInput } from './schemas';
import type { CoachReview, ReviewScope } from './types';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Cached review for a scope+target (does not trigger a model call). */
export function useReview(scope: ReviewScope, targetId: string, enabled = true) {
  return useQuery({
    queryKey: ['ai-coach', 'review', scope, targetId],
    queryFn: () => getReviewAction(scope, targetId),
    enabled: enabled && !!targetId,
    staleTime: 5 * 60_000,
  });
}

export function useHistory(limit = 20) {
  return useQuery({
    queryKey: ['ai-coach', 'history', limit],
    queryFn: () => getHistoryAction(limit),
    staleTime: 60_000,
  });
}

/** Generate/regenerate; invalidates the cached review + history on success. */
export function useGenerateReview() {
  const qc = useQueryClient();
  return useMutation<ActionResult<CoachReview>, Error, GenerateReviewInput>({
    mutationFn: (input) => generateReviewAction(input),
    onSuccess: (r, vars) => {
      if (!r.ok) return;
      qc.invalidateQueries({ queryKey: ['ai-coach', 'review', vars.scope, vars.targetId] });
      qc.invalidateQueries({ queryKey: ['ai-coach', 'history'] });
    },
  });
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation<ActionResult, Error, FeedbackInput>({
    mutationFn: (input) => submitFeedbackAction(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-coach'] }),
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation<ActionResult, Error, { scope: ReviewScope; targetId: string }>({
    mutationFn: ({ scope, targetId }) => deleteReviewAction(scope, targetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-coach'] }),
  });
}

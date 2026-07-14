'use client';

/**
 * ReviewPanel — reusable coach surface for any scope+target (used on the trade
 * detail and the AI dashboard). Reads a cached review, offers regeneration, and
 * renders evidence-linked insights with polite streaming/loading + error states.
 * Non-intrusive: nothing appears until the user asks, and it is dismissible.
 */
import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { useReview, useGenerateReview, useSubmitFeedback } from '../hooks';
import { AIInsightBlock } from './ai-insight-block';
import type { ReviewScope } from '../types';

export function ReviewPanel({
  scope,
  targetId,
  title,
}: {
  scope: ReviewScope;
  targetId: string;
  title: string;
}) {
  const cached = useReview(scope, targetId);
  const generate = useGenerateReview();
  const feedback = useSubmitFeedback();
  const [verdicts, setVerdicts] = useState<Record<string, 'accepted' | 'dismissed'>>({});

  const review = generate.data?.ok ? generate.data.data : cached.data;
  const busy = generate.isPending;
  const failed = generate.data && !generate.data.ok;

  function onFeedback(reviewId: string, insightId: string, verdict: 'accepted' | 'dismissed') {
    setVerdicts((v) => ({ ...v, [insightId]: verdict }));
    feedback.mutate({ reviewId, insightId, verdict });
  }

  return (
    <section className="space-y-3" aria-labelledby={`coach-${scope}-${targetId}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`coach-${scope}-${targetId}`} className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {title}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generate.mutate({ scope, targetId })}
          disabled={busy}
        >
          <RefreshCw className={busy ? 'motion-safe:animate-spin' : ''} aria-hidden />
          {review ? 'Regenerate' : 'Generate'}
        </Button>
      </div>

      {/* Polite live region for streaming/generation status. */}
      <p className="sr-only" role="status" aria-live="polite">
        {busy ? 'Generating your coaching review…' : review ? 'Review ready.' : ''}
      </p>

      {busy ? (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          Analyzing your data…
        </div>
      ) : null}

      {failed ? (
        <FormAlert tone="error">
          {generate.data && !generate.data.ok ? generate.data.error : 'Could not generate — retry.'}
        </FormAlert>
      ) : null}

      {!busy && review
        ? review.insights.map((insight) => (
            <AIInsightBlock
              key={insight.id}
              insight={insight}
              reviewId={review.reviewId}
              verdict={verdicts[insight.id]}
              onFeedback={
                review.reviewId
                  ? (insightId, verdict) =>
                      onFeedback(review.reviewId as string, insightId, verdict)
                  : undefined
              }
            />
          ))
        : null}

      {!busy && !review && !failed ? (
        <p className="text-sm text-muted-foreground">
          No review yet. Generate one to see evidence-linked coaching from your own data.
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Coaching is based on your recorded data and is not financial advice. It never gives buy/sell
        calls or price predictions — decisions are always yours.
      </p>
    </section>
  );
}

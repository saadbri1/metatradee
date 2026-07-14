'use client';

/**
 * AIInsightBlock — the canonical evidence-linked insight card. Renders the
 * model's narrative alongside the engine-computed evidence, a confidence badge
 * (data sufficiency), detected patterns, EvidenceLinks to real trades, and
 * accept/dismiss feedback. Non-intrusive and fully keyboard-operable.
 */
import { Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EvidenceLink } from './evidence-link';
import type { CoachInsight } from '../types';

function confidenceTone(c: number): {
  label: string;
  variant: 'default' | 'secondary' | 'outline';
} {
  if (c >= 75) return { label: `High confidence · ${c}`, variant: 'default' };
  if (c >= 50) return { label: `Moderate · ${c}`, variant: 'secondary' };
  return { label: `Low confidence · ${c}`, variant: 'outline' };
}

const SEVERITY_LABEL: Record<CoachInsight['patterns'][number]['severity'], string> = {
  attention: 'Worth attention',
  watch: 'Keep an eye on',
  info: 'Observation',
};

export function AIInsightBlock({
  insight,
  reviewId,
  onFeedback,
  verdict,
}: {
  insight: CoachInsight;
  /** Present only for persisted reviews (enables feedback). */
  reviewId?: string;
  onFeedback?: (insightId: string, verdict: 'accepted' | 'dismissed') => void;
  verdict?: 'accepted' | 'dismissed';
}) {
  const tone = confidenceTone(insight.evidence.confidence);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Coach insight
        </CardTitle>
        <Badge
          variant={tone.variant}
          aria-label={`Confidence score ${insight.evidence.confidence} of 100`}
        >
          {tone.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Narrative (model-authored, safety-scrubbed). */}
        <p className="whitespace-pre-line text-sm leading-relaxed">{insight.narrative}</p>

        {insight.evidence.confidenceNote ? (
          <p className="text-xs text-muted-foreground">{insight.evidence.confidenceNote}</p>
        ) : null}

        {/* Supporting data — the real figures, from the engines. */}
        {insight.evidence.facts.length > 0 ? (
          <div>
            <h4 className="mb-1 text-xs font-medium text-muted-foreground">Supporting data</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {insight.evidence.facts.map((f) => (
                <div key={f.label} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="tabular font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {/* Detected patterns (deterministic; the coach only prioritizes these). */}
        {insight.patterns.length > 0 ? (
          <ul className="space-y-2">
            {insight.patterns.map((p) => (
              <li key={p.kind} className="rounded-md border border-border p-2 text-sm">
                <span className="mr-2 text-xs font-medium text-muted-foreground">
                  {SEVERITY_LABEL[p.severity]}
                </span>
                {p.summary}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Evidence links to the actual trades. */}
        {insight.evidence.referencedTradeIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Referenced trades:</span>
            {insight.evidence.referencedTradeIds.slice(0, 12).map((id, i) => (
              <EvidenceLink key={id} tradeId={id} index={i} />
            ))}
          </div>
        ) : null}

        {reviewId && onFeedback ? (
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Was this useful?</span>
            <Button
              size="sm"
              variant={verdict === 'accepted' ? 'default' : 'outline'}
              onClick={() => onFeedback(insight.id, 'accepted')}
              aria-pressed={verdict === 'accepted'}
            >
              <ThumbsUp aria-hidden /> Helpful
            </Button>
            <Button
              size="sm"
              variant={verdict === 'dismissed' ? 'default' : 'ghost'}
              onClick={() => onFeedback(insight.id, 'dismissed')}
              aria-pressed={verdict === 'dismissed'}
            >
              <ThumbsDown aria-hidden /> Dismiss
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

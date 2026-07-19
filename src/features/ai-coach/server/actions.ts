'use server';

/**
 * AI Coach server actions. Every action authenticates first, then only ever
 * touches the caller's own data (RLS + explicit user_id). Model calls run
 * server-side via the provider router (keys never reach the client). Each
 * generation is audited. The model receives evidence + delimited user data; it
 * authors narrative only.
 */
import { createClient } from '@/lib/supabase/server';
import { getProviderForTask } from '../providers';
import { assertFeature } from '@/features/billing/server/enforce';
import { buildReview } from '../coach';
import { gatherReview } from './queries';
import { auditAIRequest } from './audit';
import { generateReviewSchema, feedbackSchema } from '../schemas';
import { SCOPE_TASK, type CoachReview, type ReviewScope } from '../types';

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

const GENERIC = 'Something went wrong generating your review. Please try again.';

async function uid(): Promise<{
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id, supabase } : null;
}

/** An honest "not enough data" review — no model call, no fabrication. */
function insufficientReview(scope: ReviewScope, targetId: string): CoachReview {
  return {
    scope,
    targetId,
    insights: [
      {
        id: `${scope}-${targetId}-empty`,
        scope,
        narrative:
          'There are no trades in this scope yet, so there is nothing to review. ' +
          'Once you log some trades here, the coach will analyze them.',
        evidence: { facts: [], referencedTradeIds: [], confidence: 0, confidenceNote: 'No data.' },
        patterns: [],
      },
    ],
    model: 'none',
    provider: 'none',
    usage: { input: 0, output: 0 },
    mock: false,
    generatedAt: new Date().toISOString(),
  };
}

/** Generate (or regenerate) a review for a scope+target. Persists + audits. */
export async function generateReviewAction(input: unknown): Promise<ActionResult<CoachReview>> {
  const parsed = generateReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };
  const auth = await uid();
  if (!auth) return { ok: false, error: 'You must be signed in.' };
  const { userId, supabase } = auth;
  const { scope, targetId } = parsed.data;

  // Entitlement gate BEFORE any provider work. Fails closed (unresolved => Free),
  // so a denied request never reaches the AI provider and never consumes credit.
  const gate = await assertFeature(supabase, userId, 'aiCoach');
  if (!gate.ok) return { ok: false, error: gate.reason ?? 'This is a paid feature.' };

  try {
    const gathered = await gatherReview(supabase, userId, scope, targetId);

    let review: CoachReview;
    if (gathered.empty) {
      review = insufficientReview(scope, targetId);
    } else {
      const provider = getProviderForTask(SCOPE_TASK[scope]);
      review = await buildReview(
        {
          scope,
          targetId,
          title: gathered.title,
          facts: gathered.facts,
          patternInputs: gathered.patternInputs,
          userData: gathered.userData,
          sampleSize: gathered.sampleSize,
        },
        provider,
      );
      await auditAIRequest(supabase, userId, {
        scope,
        dataScope: gathered.userData.length ? 'own:trades+notes' : 'own:trades',
        provider: review.provider,
        model: review.model,
        inputTokens: review.usage.input,
        outputTokens: review.usage.output,
      });
    }

    // Cache the current review (regeneration replaces it).
    const { data: saved, error } = await supabase
      .from('ai_reviews')
      .upsert(
        {
          user_id: userId,
          scope,
          target_id: targetId,
          insights: review.insights,
          provider: review.provider,
          model: review.model,
          input_tokens: review.usage.input,
          output_tokens: review.usage.output,
          is_mock: review.mock,
        },
        { onConflict: 'user_id,scope,target_id' },
      )
      .select('id')
      .single();
    if (error) return { ok: false, error: GENERIC };
    return { ok: true, data: { ...review, reviewId: (saved as { id: string } | null)?.id } };
  } catch (err) {
    console.error('[ai-coach] generate failed:', (err as Error).message);
    return { ok: false, error: GENERIC };
  }
}

/** Read a cached review if present (does not trigger a model call). */
export async function getReviewAction(
  scope: ReviewScope,
  targetId: string,
): Promise<CoachReview | null> {
  const auth = await uid();
  if (!auth) return null;
  const { userId, supabase } = auth;
  const { data } = await supabase
    .from('ai_reviews')
    .select(
      'id, scope, target_id, insights, provider, model, input_tokens, output_tokens, is_mock, updated_at',
    )
    .eq('user_id', userId)
    .eq('scope', scope)
    .eq('target_id', targetId)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    id: string;
    scope: ReviewScope;
    target_id: string;
    insights: CoachReview['insights'];
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    is_mock: boolean;
    updated_at: string;
  };
  return {
    reviewId: row.id,
    scope: row.scope,
    targetId: row.target_id,
    insights: row.insights,
    provider: row.provider,
    model: row.model,
    usage: { input: row.input_tokens, output: row.output_tokens },
    mock: row.is_mock,
    generatedAt: row.updated_at,
  };
}

/** Recent reviews across scopes for the AI dashboard history timeline. */
export async function getHistoryAction(limit = 20): Promise<CoachReview[]> {
  const auth = await uid();
  if (!auth) return [];
  const { userId, supabase } = auth;
  const { data } = await supabase
    .from('ai_reviews')
    .select('id, scope, target_id, insights, provider, model, is_mock, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(limit, 100));
  return (
    (data as
      | {
          id: string;
          scope: ReviewScope;
          target_id: string;
          insights: CoachReview['insights'];
          provider: string;
          model: string;
          is_mock: boolean;
          updated_at: string;
        }[]
      | null) ?? []
  ).map((row) => ({
    reviewId: row.id,
    scope: row.scope,
    targetId: row.target_id,
    insights: row.insights,
    provider: row.provider,
    model: row.model,
    usage: { input: 0, output: 0 },
    mock: row.is_mock,
    generatedAt: row.updated_at,
  }));
}

/** Record accepted/dismissed advice (feeds prioritization; owner-scoped). */
export async function submitFeedbackAction(input: unknown): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid feedback.' };
  const auth = await uid();
  if (!auth) return { ok: false, error: 'You must be signed in.' };
  const { userId, supabase } = auth;
  const { error } = await supabase.from('ai_feedback').upsert(
    {
      user_id: userId,
      review_id: parsed.data.reviewId,
      insight_id: parsed.data.insightId,
      verdict: parsed.data.verdict,
    },
    { onConflict: 'user_id,review_id,insight_id' },
  );
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

/** Delete a user's own review + its memory (user owns their AI history). */
export async function deleteReviewAction(
  scope: ReviewScope,
  targetId: string,
): Promise<ActionResult> {
  const auth = await uid();
  if (!auth) return { ok: false, error: 'You must be signed in.' };
  const { userId, supabase } = auth;
  const { error } = await supabase
    .from('ai_reviews')
    .delete()
    .eq('user_id', userId)
    .eq('scope', scope)
    .eq('target_id', targetId);
  return error ? { ok: false, error: GENERIC } : { ok: true };
}

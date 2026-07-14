/**
 * AI request audit. Every model call (real or mock) writes an append-only row:
 * who, when, scope, provider, model, token cost. Used for cost observability and
 * abuse detection — never to ration the user. Best-effort: an audit failure must
 * not block returning the user's review, but is logged.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditEntry {
  scope: string;
  dataScope: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function auditAIRequest(
  supabase: SupabaseClient,
  userId: string,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabase.from('ai_requests').insert({
    user_id: userId,
    scope: entry.scope,
    data_scope: entry.dataScope,
    provider: entry.provider,
    model: entry.model,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
  });
  if (error) console.error('[ai-coach] audit write failed:', error.message);
}

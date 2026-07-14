/**
 * Central trade write service — the ONE path that creates trades. Manual CRUD
 * actions use it now; the import engine (9.7) will call the exact same function,
 * so imported and manual trades share validation, derived-field computation, and
 * dedupe hashing (no parallel trade-writing path).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeDerivedTradeFields } from '../derived';
import { tradeContentHash } from '../dedupe';
import type { TradeCreateInput } from '../schemas';
import type { TradeSource } from '../enums';

export interface CreateTradeOptions {
  source?: TradeSource;
  importId?: string | null;
}

/** Content hash for a create-input (account+symbol+direction+time+size+entry). */
export function tradeInputHash(input: TradeCreateInput): string {
  return tradeContentHash({
    trading_account_id: input.trading_account_id ?? null,
    symbol: input.symbol,
    direction: input.direction,
    time: input.executed_at ?? input.opened_at ?? null,
    quantity: input.quantity ?? null,
    entry_price: input.entry_price ?? null,
  });
}

/** Build the DB row (derived fields + hash + provenance) from validated input. */
export function buildTradeRow(
  input: TradeCreateInput,
  userId: string,
  opts: CreateTradeOptions = {},
): Record<string, unknown> {
  const derived = computeDerivedTradeFields({
    direction: input.direction,
    entry_price: input.entry_price ?? null,
    exit_price: input.exit_price ?? null,
    quantity: input.quantity ?? null,
    stop_loss: input.stop_loss ?? null,
    take_profit: input.take_profit ?? null,
    risk_amount: input.risk_amount ?? null,
    reward: input.reward ?? null,
    commission: input.commission,
    swap: input.swap,
    fees: input.fees,
    opened_at: input.opened_at ?? null,
    closed_at: input.closed_at ?? null,
  });

  const { tag_ids: _tagIds, ...rest } = input;
  const empty = (v: unknown) => (v === '' ? null : v);

  return {
    user_id: userId,
    trading_account_id: input.trading_account_id ?? null,
    broker_id: input.broker_id ?? null,
    strategy_id: input.strategy_id ?? null,
    symbol: input.symbol,
    direction: input.direction,
    asset_type: input.asset_type ?? null,
    market: empty(rest.market),
    entry_price: input.entry_price ?? null,
    exit_price: input.exit_price ?? null,
    quantity: input.quantity ?? null,
    position_size: input.position_size ?? null,
    stop_loss: input.stop_loss ?? null,
    take_profit: input.take_profit ?? null,
    risk_percent: input.risk_percent ?? null,
    risk_amount: input.risk_amount ?? null,
    reward: input.reward ?? null,
    commission: input.commission,
    swap: input.swap,
    fees: input.fees,
    currency: input.currency,
    opened_at: input.opened_at ?? null,
    closed_at: input.closed_at ?? null,
    executed_at: input.executed_at ?? null,
    session: input.session ?? null,
    setup: empty(rest.setup),
    confidence: input.confidence ?? null,
    notes: empty(rest.notes),
    private_notes: empty(rest.private_notes),
    visibility: input.visibility,
    status: input.status,
    source: opts.source ?? 'manual',
    import_id: opts.importId ?? null,
    ...derived,
    content_hash: tradeInputHash(input),
  };
}

/** Look up an existing non-deleted full-duplicate trade for this user. */
export async function findFullDuplicate(
  supabase: SupabaseClient,
  userId: string,
  input: TradeCreateInput,
): Promise<string | null> {
  const { data } = await supabase
    .from('trades')
    .select('id')
    .eq('user_id', userId)
    .eq('content_hash', tradeInputHash(input))
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export interface CreateTradeResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Create a trade + its tag links. Idempotency for import is provided by the
 * caller supplying a stable content_hash / checking `findFullDuplicate` first;
 * this function performs the authoritative write.
 */
export async function createTradeForUser(
  supabase: SupabaseClient,
  userId: string,
  input: TradeCreateInput,
  opts: CreateTradeOptions = {},
): Promise<CreateTradeResult> {
  const row = buildTradeRow(input, userId, opts);
  const { data, error } = await supabase.from('trades').insert(row).select('id').single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };
  const id = (data as { id: string }).id;

  if (input.tag_ids && input.tag_ids.length > 0) {
    await supabase
      .from('trade_tags')
      .insert(input.tag_ids.map((tag_id) => ({ trade_id: id, tag_id, user_id: userId })));
  }
  return { ok: true, id };
}

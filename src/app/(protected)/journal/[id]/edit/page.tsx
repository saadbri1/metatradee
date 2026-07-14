import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTrade } from '@/features/journal/server/queries';
import { TradeForm } from '@/features/journal/components/trade-form';
import type { TradeCreateInput } from '@/features/journal/schemas';

export const metadata: Metadata = { title: 'Edit trade' };

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const trade = await getTrade(supabase, user.id, id);
  if (!trade) notFound();

  const defaults: Partial<TradeCreateInput> = {
    symbol: trade.symbol,
    direction: trade.direction,
    asset_type: trade.asset_type,
    market: trade.market ?? '',
    trading_account_id: trade.trading_account_id,
    broker_id: trade.broker_id,
    strategy_id: trade.strategy_id,
    entry_price: trade.entry_price,
    exit_price: trade.exit_price,
    quantity: trade.quantity,
    position_size: trade.position_size,
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
    risk_percent: trade.risk_percent,
    risk_amount: trade.risk_amount,
    reward: trade.reward,
    commission: trade.commission,
    swap: trade.swap,
    fees: trade.fees,
    currency: trade.currency,
    opened_at: trade.opened_at,
    closed_at: trade.closed_at,
    executed_at: trade.executed_at,
    session: trade.session,
    setup: trade.setup ?? '',
    confidence: trade.confidence,
    notes: trade.notes ?? '',
    private_notes: trade.private_notes ?? '',
    visibility: trade.visibility,
    status: trade.status,
    tag_ids: trade.tag_ids,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Edit trade</h1>
      <TradeForm mode="edit" tradeId={id} defaultValues={defaults} />
    </div>
  );
}

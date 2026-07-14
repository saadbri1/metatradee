import type { AnalyticsTrade } from '@/features/analytics';

/** Minimal AnalyticsTrade factory for deterministic AI-coach tests. */
export function trade(over: Partial<AnalyticsTrade> = {}): AnalyticsTrade {
  return {
    id: over.id ?? crypto.randomUUID(),
    net_pnl: over.net_pnl ?? null,
    pnl: over.pnl ?? over.net_pnl ?? null,
    rr_ratio: over.rr_ratio ?? null,
    quantity: over.quantity ?? 1,
    position_size: over.position_size ?? null,
    risk_amount: over.risk_amount ?? null,
    risk_percent: over.risk_percent ?? null,
    direction: over.direction ?? 'buy',
    symbol: over.symbol ?? 'AAPL',
    market: over.market ?? null,
    asset_type: over.asset_type ?? null,
    session: over.session ?? 'new_york',
    strategy_id: over.strategy_id ?? null,
    broker_id: over.broker_id ?? null,
    trading_account_id: over.trading_account_id ?? null,
    source: over.source ?? 'manual',
    opened_at: over.opened_at ?? '2026-01-01T14:00:00Z',
    closed_at: over.closed_at ?? '2026-01-01T15:00:00Z',
    duration_seconds: over.duration_seconds ?? 3600,
  };
}

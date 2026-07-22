import type { SupabaseClient } from '@supabase/supabase-js';
import { listTradingAccounts } from '@/features/accounts/server/queries';
import type { DashboardData, DashboardTrade } from '../types';

const DASHBOARD_TRADE_COLUMNS =
  'id, net_pnl, pnl, rr_ratio, quantity, position_size, risk_amount, risk_percent, direction, symbol, market, asset_type, session, strategy_id, broker_id, trading_account_id, source, entry_price, exit_price, currency, opened_at, closed_at, duration_seconds, notes, created_at';

export async function getDashboardData(
  supabase: SupabaseClient,
  userId: string,
  timezone = 'UTC',
): Promise<DashboardData> {
  const [accounts, tradeResult, importResult] = await Promise.all([
    listTradingAccounts(supabase, userId),
    supabase
      .from('trades')
      .select(DASHBOARD_TRADE_COLUMNS)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('closed_at', { ascending: false, nullsFirst: false })
      .limit(5000),
    supabase
      .from('imports')
      .select('status, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const latestImport = importResult.data as { status: string; updated_at: string } | null;
  return {
    accounts,
    trades: (tradeResult.data as DashboardTrade[] | null) ?? [],
    lastImportAt: latestImport?.updated_at ?? null,
    lastImportStatus: latestImport?.status ?? null,
    timezone,
  };
}

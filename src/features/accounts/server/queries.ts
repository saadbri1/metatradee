import type { SupabaseClient } from '@supabase/supabase-js';
import type { TradingAccount } from '../types';

const ACCOUNT_COLUMNS =
  'id, user_id, name, account_type, provider, external_account_identifier, base_currency, starting_balance, account_size, status, connection_method, import_status, last_successful_import_at, is_default, created_at, updated_at';

export async function listTradingAccounts(
  supabase: SupabaseClient,
  userId: string,
  includeArchived = false,
): Promise<TradingAccount[]> {
  let query = supabase
    .from('trading_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (!includeArchived) query = query.neq('status', 'archived');
  const { data } = await query;
  return (data as TradingAccount[] | null) ?? [];
}

export async function ownsTradingAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('trading_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  return Boolean(data);
}

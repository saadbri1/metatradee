export const ACCOUNT_TYPES = ['broker', 'demo', 'funded'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_STATUSES = [
  'active',
  'disconnected',
  'import_required',
  'syncing',
  'sync_failed',
  'archived',
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type AccountImportStatus = 'import_required' | 'ready' | 'syncing' | 'sync_failed';
export type ConnectionMethod = 'manual' | 'file' | 'simulation';

export interface TradingAccount {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  provider: string | null;
  external_account_identifier: string | null;
  base_currency: string;
  starting_balance: number;
  account_size: number | null;
  status: AccountStatus;
  connection_method: ConnectionMethod;
  import_status: AccountImportStatus;
  last_successful_import_at: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type AccountSource = AccountType | 'unassigned';

export type AccountActionResult =
  { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

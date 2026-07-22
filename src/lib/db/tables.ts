/**
 * Table-name constants and TanStack Query key roots for the 9.3 core tables.
 * Import these instead of hardcoding strings so renames are single-point.
 */
export const TABLES = {
  profiles: 'profiles',
  userPreferences: 'user_preferences',
  userSettings: 'user_settings',
  strategies: 'strategies',
  tags: 'tags',
  attachments: 'attachments',
  tradingAccounts: 'trading_accounts',
  accountBalanceSnapshots: 'account_balance_snapshots',
  tradingProfiles: 'trading_profiles',
  brokers: 'brokers',
  trades: 'trades',
  tradeTags: 'trade_tags',
  savedFilters: 'saved_filters',
  tradeCollections: 'trade_collections',
  tradeCollectionItems: 'trade_collection_items',
} as const;

export const STORAGE_BUCKETS = {
  avatars: 'avatars',
  attachments: 'attachments',
} as const;

/** Query-key roots; features extend these namespaces (e.g. [...tags, { category }]). */
export const QUERY_KEYS = {
  strategies: ['strategies'] as const,
  tags: ['tags'] as const,
  attachments: ['attachments'] as const,
  tradingAccounts: ['trading_accounts'] as const,
} as const;

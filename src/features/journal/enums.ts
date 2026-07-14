/** Trade enumerations — mirror the trades CHECK constraints. */
export const ASSET_TYPES = [
  'forex',
  'stocks',
  'futures',
  'crypto',
  'options',
  'commodities',
  'index',
  'other',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const DIRECTIONS = ['buy', 'sell'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const TRADE_SESSIONS = ['asian', 'london', 'new_york', 'sydney'] as const;
export type TradeSession = (typeof TRADE_SESSIONS)[number];

export const TRADE_STATUSES = ['draft', 'published'] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const TRADE_VISIBILITY = ['private', 'shared'] as const;
export type TradeVisibility = (typeof TRADE_VISIBILITY)[number];

export const TRADE_SOURCES = ['manual', 'imported'] as const;
export type TradeSource = (typeof TRADE_SOURCES)[number];

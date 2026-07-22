/**
 * Canonical enumerations for the 9.3 core tables. These MUST stay in sync with
 * the CHECK constraints in the database_core migration. Kept as `as const`
 * tuples so they double as Zod enum sources and TS union types.
 */

export const TAG_CATEGORIES = ['setup', 'mistake', 'emotion', 'custom'] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];

export const ATTACHMENT_KINDS = ['avatar', 'screenshot', 'document', 'other'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

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

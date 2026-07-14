/**
 * Hand-written row types for the 9.3 core tables. These are narrow, app-facing
 * shapes so the codebase type-checks without a live project. Replace with
 * `supabase gen types` output when a project exists (see supabase/README.md).
 */
import type { AccountStatus, AccountType, AttachmentKind, TagCategory } from './enums';

interface Timestamped {
  created_at: string;
  updated_at: string;
}

export interface Strategy extends Timestamped {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_archived: boolean;
  deleted_at: string | null;
}

export interface Tag extends Timestamped {
  id: string;
  user_id: string;
  name: string;
  category: TagCategory;
  color: string | null;
  is_system: boolean;
}

export interface Attachment extends Timestamped {
  id: string;
  user_id: string;
  bucket: string;
  path: string;
  kind: AttachmentKind;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  deleted_at: string | null;
}

export interface TradingAccount extends Timestamped {
  id: string;
  user_id: string;
  name: string;
  broker: string | null;
  account_type: AccountType;
  base_currency: string;
  starting_balance: number;
  status: AccountStatus;
  is_default: boolean;
  deleted_at: string | null;
}

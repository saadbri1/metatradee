import type { AccountCreateInput } from './schemas';
import type { AccountStatus, ConnectionMethod } from './types';

export function accountDefaults(type: AccountCreateInput['account_type']): {
  status: AccountStatus;
  connection_method: ConnectionMethod;
  import_status: 'import_required' | 'ready';
} {
  if (type === 'demo') {
    return { status: 'active', connection_method: 'simulation', import_status: 'ready' };
  }
  return { status: 'import_required', connection_method: 'file', import_status: 'import_required' };
}

export function accountTypeLabel(type: AccountCreateInput['account_type']): string {
  if (type === 'broker') return 'Broker';
  if (type === 'funded') return 'Funded';
  return 'Demo';
}

export function canReceiveFileImports(type: AccountCreateInput['account_type']): boolean {
  return type === 'broker' || type === 'funded';
}

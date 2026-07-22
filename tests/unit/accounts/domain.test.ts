import { describe, expect, it } from 'vitest';
import { accountDefaults, canReceiveFileImports } from '@/features/accounts/domain';
import { accountCreateSchema, accountStatusSchema } from '@/features/accounts/schemas';

describe('account domain', () => {
  it('creates a deterministic demo account definition', () => {
    const parsed = accountCreateSchema.parse({
      account_type: 'demo',
      name: 'Replay 50K',
      base_currency: 'usd',
      starting_balance: 50_000,
    });
    expect(parsed).toMatchObject({
      account_type: 'demo',
      base_currency: 'USD',
      starting_balance: 50_000,
    });
    expect(accountDefaults('demo')).toEqual({
      status: 'active',
      connection_method: 'simulation',
      import_status: 'ready',
    });
  });

  it('requires real funded identity and account size', () => {
    expect(
      accountCreateSchema.safeParse({ account_type: 'funded', name: 'Eval', starting_balance: 0 })
        .success,
    ).toBe(false);
    const parsed = accountCreateSchema.parse({
      account_type: 'funded',
      name: 'Eval 100K',
      provider: 'Example Firm',
      starting_balance: 100_000,
      account_size: 100_000,
    });
    expect(parsed.account_size).toBe(100_000);
    expect(accountDefaults('funded').status).toBe('import_required');
  });

  it('keeps unsupported live broker connectivity in file-import state', () => {
    expect(canReceiveFileImports('broker')).toBe(true);
    expect(canReceiveFileImports('funded')).toBe(true);
    expect(canReceiveFileImports('demo')).toBe(false);
    expect(accountDefaults('broker')).toEqual({
      status: 'import_required',
      connection_method: 'file',
      import_status: 'import_required',
    });
  });

  it('accepts owner-managed disconnect/archive statuses and rejects unknown states', () => {
    const id = '8b223cc4-83fd-42de-99a7-2893294bd830';
    expect(accountStatusSchema.safeParse({ id, status: 'disconnected' }).success).toBe(true);
    expect(accountStatusSchema.safeParse({ id, status: 'archived' }).success).toBe(true);
    expect(accountStatusSchema.safeParse({ id, status: 'connected_live' }).success).toBe(false);
  });
});

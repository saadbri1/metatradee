import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static invariant suite over every migration. This is the CI-runnable guard for
 * the Phase 9.3 security contract: it fails the build if ANY future migration
 * adds a table without RLS, without a policy, or duplicates auth.users.
 *
 * PENDING-LIVE (cannot run here, no Supabase project): actual cross-user
 * isolation (user B selecting user A's rows must return zero) and storage-policy
 * enforcement must be exercised against a live database with two real JWTs.
 */
/**
 * Forward migrations and rollbacks live in SEPARATE directories.
 *
 * The Supabase CLI globs `supabase/migrations/*.sql` and parses the leading
 * digits as the version — it has no notion of a "down" file. With both kinds in
 * one directory, `20260712120000_auth_foundation.down.sql` was a valid migration
 * claiming the SAME version as its forward file, and sorted BEFORE it ('d' < 's'),
 * so `db push` ran each rollback immediately before the migration it reverses and
 * then failed on the duplicate primary key in `schema_migrations`.
 *
 * Keeping rollbacks in `supabase/rollback/` means the CLI can only ever see the
 * 21 forward migrations.
 */
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const ROLLBACK_DIR = join(process.cwd(), 'supabase', 'rollback');

const files = readdirSync(MIGRATIONS_DIR).filter(
  (f) => f.endsWith('.sql') && !f.endsWith('.down.sql'),
);
const sql = files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n');

/**
 * Tables that intentionally have RLS + ZERO policies (deny-all to clients).
 *
 * `integration_report_sessions` holds broker report-generation state keyed by a
 * one-way credential fingerprint. It contains no user data and no secret, and
 * must never be readable with the anon or authenticated key — only server-side
 * service-role code touches it.
 */
const SERVICE_ROLE_ONLY = new Set(['billing_events', 'integration_report_sessions']);

function createdTables(source: string): string[] {
  const re = /create table if not exists public\.([a-z_]+)/g;
  return [...source.matchAll(re)].map((m) => m[1] as string);
}

describe('migration hygiene', () => {
  it('every migration has a paired rollback in supabase/rollback', () => {
    const downs = new Set(readdirSync(ROLLBACK_DIR).filter((f) => f.endsWith('.down.sql')));
    for (const f of files) {
      expect(downs.has(f.replace(/\.sql$/, '.down.sql')), `missing rollback for ${f}`).toBe(true);
    }
  });

  it('keeps rollbacks OUT of the migrations directory', () => {
    // The regression guard: a `.down.sql` here is a forward migration to the
    // Supabase CLI, and collides with its forward file's version.
    const strays = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.down.sql'));
    expect(strays, `rollback files must live in supabase/rollback: ${strays.join(', ')}`).toEqual(
      [],
    );
  });

  it('gives every forward migration a unique version, so the CLI cannot collide', () => {
    const versions = files.map((f) => f.split('_')[0]);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('has no orphaned rollback without a forward migration', () => {
    const forward = new Set(files);
    const orphans = readdirSync(ROLLBACK_DIR)
      .filter((f) => f.endsWith('.down.sql'))
      .filter((f) => !forward.has(f.replace(/\.down\.sql$/, '.sql')));
    expect(orphans).toEqual([]);
  });

  it('every table creation is idempotent (if not exists)', () => {
    // A bare `create table public.x` (without the guard) would break re-runs.
    expect(/create table (?!if not exists)public\./.test(sql)).toBe(false);
  });

  it('never duplicates auth.users', () => {
    expect(/create table if not exists public\.users\b/.test(sql)).toBe(false);
    // Ownership is always an FK to auth.users.
    expect(sql).toContain('references auth.users (id) on delete cascade');
  });
});

describe('RLS is enabled + policied on EVERY table (security contract)', () => {
  const tables = createdTables(sql);

  it('discovers the full table set', () => {
    expect(tables.length).toBeGreaterThan(40);
  });

  it.each(tables)('table %s has RLS enabled', (table) => {
    expect(sql).toContain(`alter table public.${table} enable row level security`);
  });

  it.each(tables)('table %s has at least one policy (or is service-role-only)', (table) => {
    const hasPolicy = new RegExp(`create policy "[^"]+"\\s*\\n?\\s*on public\\.${table}\\b`).test(
      sql,
    );
    expect(hasPolicy || SERVICE_ROLE_ONLY.has(table)).toBe(true);
  });
});

describe('9.3 gap-fill: is_admin() RBAC seam', () => {
  it('defines a single fail-closed is_admin() and grants it to authenticated only', () => {
    expect(sql).toContain('create or replace function public.is_admin()');
    // Fail-closed: coalesce(..., false).
    expect(sql).toMatch(/is_admin\(\)[\s\S]*coalesce\([\s\S]*false\s*\)/);
    expect(sql).toContain('revoke all on function public.is_admin() from public');
    expect(sql).toContain('grant execute on function public.is_admin() to authenticated');
  });

  it('brokers is auth-read + admin-write (reference table) via the is_admin() seam', () => {
    expect(sql).toContain('create policy "brokers_select_all" on public.brokers');
    for (const op of ['insert', 'update', 'delete']) {
      expect(sql).toContain(`create policy "brokers_${op}_admin" on public.brokers`);
    }
    expect(sql).toMatch(/brokers_insert_admin[\s\S]*with check \(public\.is_admin\(\)\)/);
  });
});

describe('9.3 gap-fill: notifications', () => {
  it('is owner-scoped for select/update/delete', () => {
    for (const op of ['select', 'update', 'delete']) {
      expect(sql).toContain(`create policy "notifications_${op}_own" on public.notifications`);
    }
    expect(sql).toMatch(/notifications_select_own[\s\S]*using \(auth\.uid\(\) = user_id\)/);
    // WITH CHECK on update prevents re-assigning a row to another user.
    expect(sql).toMatch(/notifications_update_own[\s\S]*with check \(auth\.uid\(\) = user_id\)/);
  });

  it('has NO client insert policy (clients cannot fabricate notifications)', () => {
    expect(/create policy "notifications_insert/.test(sql)).toBe(false);
  });

  it('cascades on user delete and indexes the unread hot path', () => {
    expect(sql).toMatch(/notifications[\s\S]*user_id\s+uuid not null references auth\.users/);
    expect(sql).toContain('notifications_user_unread_idx');
  });
});

describe('9.3 gap-fill: trading_accounts.broker_id', () => {
  it('adds an optional broker FK that never cascade-deletes a user account', () => {
    expect(sql).toContain('add column if not exists broker_id uuid references public.brokers (id)');
    // Reference data removal must NOT destroy a user's account.
    expect(sql).toMatch(/broker_id uuid references public\.brokers \(id\) on delete set null/);
  });
});

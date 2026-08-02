/**
 * PayPal secret containment.
 *
 * The single worst outcome of this integration would be `PAYPAL_CLIENT_SECRET`
 * reaching a browser bundle. In Next.js that happens by accident in exactly two
 * ways: naming a variable `NEXT_PUBLIC_*`, or importing a server module from a
 * client component. These tests close both doors by reading the real source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = walk(SRC);
const read = (f: string) => readFileSync(f, 'utf8');

describe('the client secret can never be public', () => {
  it('no NEXT_PUBLIC_ variable carries a secret', () => {
    for (const file of FILES) {
      const source = read(file);
      expect(source, file).not.toMatch(/NEXT_PUBLIC_[A-Z_]*SECRET/);
      expect(source, file).not.toMatch(/NEXT_PUBLIC_PAYPAL_CLIENT_SECRET/);
    }
  });

  it('only the SDK client id is exposed publicly', () => {
    const env = read(join(SRC, 'config/env.ts'));
    // The public schema may name the client id...
    expect(env).toContain('NEXT_PUBLIC_PAYPAL_CLIENT_ID');
    // ...and the secret only in the SERVER schema.
    const serverPart = env.slice(env.indexOf('Server-only environment'));
    expect(serverPart).toContain('PAYPAL_CLIENT_SECRET');
    const publicPart = env.slice(0, env.indexOf('Server-only environment'));
    expect(publicPart).not.toContain('PAYPAL_CLIENT_SECRET');
  });

  it('the PayPal API client is marked server-only so a client import fails the build', () => {
    const client = read(join(SRC, 'features/billing/providers/paypal/client.ts'));
    expect(client).toMatch(/^import 'server-only';/m);
    const planMap = read(join(SRC, 'features/billing/providers/paypal/plan-map.ts'));
    expect(planMap).toMatch(/^import 'server-only';/m);
  });

  it('no client component imports the PayPal API client or the plan map', () => {
    for (const file of FILES) {
      const source = read(file);
      if (!source.trimStart().startsWith("'use client'")) continue;
      /*
       * Anchored on the END of the module specifier. The unanchored version
       * matched any path STARTING with those names, so a sibling module was
       * flagged purely for sharing a prefix. Anchoring keeps the two modules
       * that actually hold the secret firmly banned while letting a genuinely
       * browser-safe neighbour exist beside them.
       */
      expect(source, `${file} is a client component`).not.toMatch(
        /providers\/paypal\/(client|plan-map)['"]/,
      );
    }
  });

  it('the secret is never interpolated into a log, error message or response', () => {
    const client = read(join(SRC, 'features/billing/providers/paypal/client.ts'));
    // It may be read from env and used for Basic auth, and nowhere else.
    const uses = [...client.matchAll(/clientSecret/g)];
    expect(uses.length).toBeGreaterThan(0);
    expect(client).not.toMatch(/console\.(log|info|warn|error)\([^)]*[Ss]ecret/);
    expect(client).not.toMatch(/message:.*clientSecret/);
    // The auth failure path must not echo the response body back.
    expect(client).toMatch(/PayPal authentication failed/);
  });

  it('leaves no PayPal secret committed anywhere in source', () => {
    for (const file of FILES) {
      const source = read(file);
      // PayPal live/sandbox client secrets are long opaque strings; a literal
      // assignment is always a mistake.
      expect(source, file).not.toMatch(/PAYPAL_CLIENT_SECRET\s*[:=]\s*['"][^'"]{10,}/);
    }
  });
});

describe('env template documents the new variables without values', () => {
  it('.env.example lists the PayPal names only', () => {
    const examplePath = join(ROOT, '.env.example');
    if (!existsSync(examplePath)) return; // template is optional
    const example = read(examplePath);
    expect(example).toContain('PAYPAL_CLIENT_ID');
    expect(example).toContain('PAYPAL_WEBHOOK_ID');
    // The template must name the secret but never carry a value. `[^\S\n]` so
    // the match cannot run past the end of the line onto the next variable.
    expect(example).toMatch(/^PAYPAL_CLIENT_SECRET=[^\S\n]*$/m);
    expect(example).not.toMatch(/^PAYPAL_CLIENT_SECRET=[^\S\n]*\S+/m);
  });
});

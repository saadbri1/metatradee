/**
 * Architectural boundaries for the chatbot.
 *
 * These are grep-style assertions over the source, and they exist because the
 * mistakes they catch are invisible at runtime until they are catastrophic:
 *
 *   A CLIENT COMPONENT IMPORTING A SERVER MODULE. The answer engine reads the
 *   AI provider configuration. If a client file ever imports it directly rather
 *   than through the route, the bundler is being asked to ship that path to the
 *   browser — `import 'server-only'` is what turns that into a build error, so
 *   this test verifies the marker is actually present.
 *
 *   THE ADMIN MAILBOX LEAKING. `ADMIN_EMAIL` is deliberately not part of
 *   `COMPANY_EMAILS` so that "render every company address" cannot pick it up.
 *   The chatbot renders addresses, so it is checked here too.
 *
 *   A SECOND SENDER. Escalation must go through the Phase 2 action; a direct
 *   call to the transport from this feature would bypass the honeypot, the
 *   timing check, the rate limit and the recipient decision all at once.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_EMAIL, COMPANY_EMAILS } from '@/config/contact';

const ROOT = join(process.cwd(), 'src/features/support-chat');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const FILES = walk(ROOT).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
const read = (path: string) => readFileSync(path, 'utf8');

describe('the feature is laid out as expected', () => {
  it('ships every file the chatbot needs', () => {
    const names = FILES.map((f) => f.replace(`${ROOT}/`, ''));
    for (const expected of [
      'types.ts',
      'translations.ts',
      'knowledge.ts',
      'redaction.ts',
      'schemas.ts',
      'transcript.ts',
      'use-support-chat.ts',
      'server/answer.ts',
      'server/actions.ts',
      'components/chatbot-launcher.tsx',
      'components/chatbot-panel.tsx',
      'components/chatbot-messages.tsx',
      'components/chatbot-input.tsx',
      'components/chatbot-language-selector.tsx',
      'components/chatbot-quick-actions.tsx',
      'components/chatbot-support-form.tsx',
    ]) {
      expect(names, expected).toContain(expected);
    }
  });
});

describe('the server boundary holds', () => {
  it('marks the answer engine as server-only', () => {
    expect(read(join(ROOT, 'server/answer.ts'))).toContain("import 'server-only'");
  });

  it('keeps the AI provider router out of every client file', () => {
    for (const file of FILES.filter((f) => read(f).startsWith("'use client'"))) {
      expect(read(file), file).not.toContain('ai-coach/providers');
      expect(read(file), file).not.toContain('server/answer');
    }
  });

  it('does not re-export the server modules from the feature barrel', () => {
    // The barrel is imported by client components; a server export here would
    // pull `server-only` into the browser graph for the whole feature.
    const barrel = read(join(ROOT, 'index.ts'));
    expect(barrel).not.toContain('./server/');
  });
});

describe('no second email path', () => {
  it('never calls the transport directly', () => {
    for (const file of FILES) {
      expect(read(file), file).not.toContain('@/server/email');
    }
  });

  it('escalates through the Phase 2 support action', () => {
    expect(read(join(ROOT, 'server/actions.ts'))).toContain(
      "from '@/features/contact/server/actions'",
    );
    expect(read(join(ROOT, 'server/actions.ts'))).toContain('submitSupportRequestAction');
  });

  it('offers only the support mailbox as a fallback', () => {
    const form = read(join(ROOT, 'components/chatbot-support-form.tsx'));
    expect(form).toContain('COMPANY_EMAILS.support');
    expect(form).toContain("mailto('support')");
  });
});

describe('the admin mailbox never appears', () => {
  it('is absent from every chatbot file', () => {
    for (const file of FILES) {
      expect(read(file), file).not.toContain(ADMIN_EMAIL);
      expect(read(file), file).not.toContain('ADMIN_EMAIL');
    }
  });

  it('and no address is hardcoded instead of imported', () => {
    for (const file of FILES) {
      for (const address of Object.values(COMPANY_EMAILS)) {
        expect(read(file), `${file} hardcodes ${address}`).not.toContain(address);
      }
    }
  });
});

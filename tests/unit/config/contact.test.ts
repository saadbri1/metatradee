/**
 * Company email routing.
 *
 * The load-bearing rule is the LAST describe block: `admin@metatradee.com` is
 * an internal operations mailbox and must never reach a browser. A leaked
 * internal address is not reversible — it gets scraped, and it starts receiving
 * customer mail nobody is watching.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { COMPANY_EMAILS, ADMIN_EMAIL, PUBLIC_EMAIL_PURPOSE, mailto } from '@/config/contact';

const SRC = resolve(__dirname, '../../../src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('every public address is defined once, with a documented purpose', () => {
  it('exposes exactly the four public mailboxes', () => {
    expect(Object.keys(COMPANY_EMAILS).sort()).toEqual(['contact', 'info', 'sales', 'support']);
  });

  it('maps each key to its own metatradee.com address', () => {
    expect(COMPANY_EMAILS.contact).toBe('contact@metatradee.com');
    expect(COMPANY_EMAILS.info).toBe('info@metatradee.com');
    expect(COMPANY_EMAILS.sales).toBe('sales@metatradee.com');
    expect(COMPANY_EMAILS.support).toBe('support@metatradee.com');
    // No two purposes may share a mailbox, or routing silently collapses.
    expect(new Set(Object.values(COMPANY_EMAILS)).size).toBe(4);
  });

  it('documents what every public address is for', () => {
    for (const key of Object.keys(COMPANY_EMAILS)) {
      expect(PUBLIC_EMAIL_PURPOSE[key as keyof typeof COMPANY_EMAILS]).toBeTruthy();
    }
  });

  it('builds mailto links, encoding the subject', () => {
    expect(mailto('sales')).toBe('mailto:sales@metatradee.com');
    expect(mailto('support', 'Import failed: MT5')).toBe(
      'mailto:support@metatradee.com?subject=Import%20failed%3A%20MT5',
    );
  });
});

describe('the admin mailbox is never publicly exposed', () => {
  it('is not part of COMPANY_EMAILS', () => {
    /*
     * Kept out of the record on purpose. "Render every company email" is the
     * natural shape of a contact block, and if admin were a member, that shape
     * would publish it.
     */
    expect(Object.values(COMPANY_EMAILS)).not.toContain(ADMIN_EMAIL);
    expect(JSON.stringify(COMPANY_EMAILS)).not.toContain('admin@');
  });

  it('appears in no client component, marketing surface or SEO output', () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith(join('config', 'contact.ts')))
      .filter((f) => readFileSync(f, 'utf8').includes('admin@metatradee.com'));
    expect(offenders, `admin address found in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('is not referenced by any file marked "use client"', () => {
    // Belt and braces: even a future server/client boundary mistake is caught.
    const clientFiles = walk(SRC).filter((f) => {
      const src = readFileSync(f, 'utf8');
      return src.startsWith("'use client'") || src.startsWith('"use client"');
    });
    const leaks = clientFiles.filter((f) => readFileSync(f, 'utf8').includes('ADMIN_EMAIL'));
    expect(leaks, `ADMIN_EMAIL imported by client component(s): ${leaks.join(', ')}`).toEqual([]);
  });
});

describe('published surfaces use the right mailbox', () => {
  const surfaceFile = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
  const seo = readFileSync(join(SRC, 'features/marketing/seo.ts'), 'utf8');
  const footer = readFileSync(join(SRC, 'features/marketing/components/footer.tsx'), 'utf8');

  it('structured data publishes support, sales and contact — never admin', () => {
    expect(seo).toContain('COMPANY_EMAILS.support');
    expect(seo).toContain('COMPANY_EMAILS.sales');
    expect(seo).toContain('COMPANY_EMAILS.contact');
    expect(seo).not.toContain('ADMIN_EMAIL');
  });

  it('the footer links to the real contact and support routes', () => {
    expect(footer).toContain("'/contact'");
    expect(footer).toContain("'/support'");
  });

  it('every public surface routes by intent, not to one catch-all inbox', () => {
    const surface = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

    // Support page: support and sales only. A frustrated user should not have
    // to choose between four addresses.
    const support = surface('app/support/page.tsx');
    expect(support).toContain("c.key === 'support'");
    expect(support).toContain("c.key === 'sales'");

    // Pricing sends commercial questions to sales, never to support.
    const pricing = surface('app/pricing/page.tsx');
    expect(pricing).toContain("mailto('sales'");
    expect(pricing).not.toContain("mailto('support'");

    // In-app help sends BILLING to support, not sales — someone with a charge
    // problem is not a sales lead.
    const help = surface('app/(protected)/help/page.tsx');
    expect(help).toContain("key: 'support' as const");
    expect(help).toContain("mailto('sales'");

    // The contact page offers all four public routes.
    const channels = surface('features/marketing/components/contact-channels.tsx');
    for (const key of ['support', 'sales', 'contact', 'info']) {
      expect(channels, `channel missing: ${key}`).toContain(`key: '${key}'`);
    }
  });

  it('lists the new public pages in the sitemap', () => {
    const sitemap = surfaceFile('app/sitemap.ts');
    expect(sitemap).toContain('/contact');
    expect(sitemap).toContain('/support');
  });

  it('no file hardcodes a metatradee.com address outside the config', () => {
    /*
     * The point of a central config is that adding a mailto somewhere else
     * defeats it. This fails the moment an address is pasted into a component.
     */
    const hardcoded = walk(SRC)
      .filter((f) => !f.endsWith(join('config', 'contact.ts')))
      .filter((f) => /[\w.]+@metatradee\.com/.test(readFileSync(f, 'utf8')));
    expect(hardcoded, `hardcoded address in: ${hardcoded.join(', ')}`).toEqual([]);
  });
});

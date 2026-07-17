// @ts-check
/**
 * Capture real MetaTradee product screenshots for the marketing site.
 *
 * REAL UI ONLY. This signs into a SEEDED DEMO account (clearly non-real sample
 * data) and screenshots each authenticated surface at 2x DPR in the dark theme.
 * It never touches real user data and never fabricates performance figures.
 *
 * Prerequisites (all provided by you — none are committed):
 *   - A running app (local `pnpm build && pnpm start`, or a staging URL)
 *   - A seeded demo account with sample trades
 *   - Env: MARKETING_SHOTS_BASE_URL, DEMO_EMAIL, DEMO_PASSWORD
 *
 * Run:
 *   MARKETING_SHOTS_BASE_URL=https://staging.metatradee.app \
 *   DEMO_EMAIL=demo@metatradee.app DEMO_PASSWORD=... \
 *   node scripts/capture-marketing-screenshots.mjs
 *
 * Output: public/marketing/screenshots/<surface>.png  (wired into the site via
 * next/image once present).
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const BASE = process.env.MARKETING_SHOTS_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;

const SURFACES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'journal', path: '/journal' },
  { name: 'analytics', path: '/analytics' },
  { name: 'ai-coach', path: '/ai-coach' },
  { name: 'calendar', path: '/calendar' },
  { name: 'reports', path: '/reports' },
  { name: 'workspace', path: '/settings/workspace' },
];

if (!EMAIL || !PASSWORD) {
  console.error(
    'Refusing to run without DEMO_EMAIL and DEMO_PASSWORD (a seeded demo account). ' +
      'This script only ever captures a demo account — never real user data.',
  );
  process.exit(1);
}

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'marketing',
  'screenshots',
);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
const page = await context.newPage();

// Sign in once (session reused for every surface).
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.getByLabel(/email/i).fill(EMAIL);
await page.getByLabel(/password/i).fill(PASSWORD);
await page.getByRole('button', { name: /log in|sign in/i }).click();
await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

for (const surface of SURFACES) {
  await page.goto(`${BASE}${surface.path}`, { waitUntil: 'networkidle' });
  // Let charts/data settle before the shot.
  await page.waitForTimeout(1200);
  const file = join(outDir, `${surface.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`captured ${surface.name} → ${file}`);
}

await browser.close();
console.log('\nDone. Optimize + reference these via next/image in the marketing sections.');

import { test, expect } from '@playwright/test';

/**
 * Shell routing. Runnable without a backend: all in-app routes are protected, so
 * unauthenticated hits redirect to login. Authenticated navigation, active
 * highlight, ⌘K, and responsive/drawer behavior need a live session and are
 * scaffolded as `test.skip` (enable with a real Supabase test project).
 */

test.describe('shell route protection', () => {
  const routes = ['/dashboard', '/journal', '/analytics', '/chart', '/settings/profile'];
  for (const route of routes) {
    test(`${route} redirects unauthenticated to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(route).replace(/%/g, '%')}`),
      );
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    });
  }
});

test.describe('authenticated shell (needs live Supabase)', () => {
  test.skip('sidebar navigates, active item marked, ⌘K jumps to routes', async () => {
    // 1. Sign in (seeded, onboarded user).
    // 2. Assert sidebar nav landmark + links; click Journal → /journal; aria-current set.
    // 3. Press ⌘K → palette opens (focus trapped); type "Analytics" → Enter → /analytics.
    // 4. Resize to mobile → bottom tab bar visible; open drawer → focus trap + Esc closes.
  });
});

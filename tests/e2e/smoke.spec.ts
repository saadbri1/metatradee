import { test, expect } from '@playwright/test';

test('home renders the marketing landing page', async ({ page }) => {
  await page.goto('/');
  // The wordmark is a <span> inside the home link; the page's single <h1> is the
  // hero headline (features/marketing/components/hero.tsx). Assert the real
  // heading so this test stays honest about the page that actually ships.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('verified data');
  await expect(page.getByRole('link', { name: /MetaTradee home/i })).toBeVisible();
});

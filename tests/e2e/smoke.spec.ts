import { test, expect } from '@playwright/test';

test('home renders the foundation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MetaTradee' })).toBeVisible();
});

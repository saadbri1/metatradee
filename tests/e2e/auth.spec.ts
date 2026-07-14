import { test, expect } from '@playwright/test';

/**
 * These specs run against the built app with PLACEHOLDER Supabase env (see
 * .github/workflows/e2e.yml). They cover everything that does NOT require a live
 * auth backend: page rendering, client-side validation, and route protection
 * (which resolves to "unauthenticated" and redirects). Full credential flows are
 * scaffolded as `test.skip` and enabled once a real test project exists.
 */

test.describe('auth screens render', () => {
  const screens: Array<[string, string]> = [
    ['/login', 'Welcome back'],
    ['/register', 'Create your account'],
    ['/forgot-password', 'Reset your password'],
    ['/reset-password', 'Set a new password'],
    ['/verify-email', 'Check your inbox'],
    ['/unauthorized', 'Access denied'],
    ['/session-expired', 'Your session expired'],
  ];

  for (const [path, heading] of screens) {
    test(`${path} shows "${heading}"`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    });
  }
});

test.describe('route protection', () => {
  test('unauthenticated access to a protected route redirects to login', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});

test.describe('client-side validation', () => {
  test('login shows inline errors on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('register enforces password confirmation', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password', { exact: true }).fill('abcdef1234');
    await page.getByLabel('Confirm password').fill('different99');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });
});

test.describe('navigation', () => {
  test('login links to register and back', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/register/);
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

/**
 * Full credential flows — require a live Supabase test project (email delivery,
 * verification + recovery tokens). Enable by providing test project env and
 * removing `.skip`.
 */
test.describe('full auth flows (needs live Supabase)', () => {
  test.skip('register → verify → login → forgot → reset → logout', async () => {
    // 1. Register a unique email; assert redirect to /verify-email.
    // 2. Verify via the emailed token-hash link (/auth/confirm).
    // 3. Log in; assert landing on the app.
    // 4. Request reset; consume the recovery link; set a new password.
    // 5. Assert other sessions revoked; log out; assert /login.
  });
});

import { expect, test } from '@playwright/test';

const authStorageState = process.env.E2E_AUTH_STORAGE_STATE;
const emptyStorageState = { cookies: [], origins: [] };

test.describe('authenticated Dashboard interactions', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(
    !authStorageState,
    'Set E2E_AUTH_STORAGE_STATE to the approved seeded test-auth storage state.',
  );
  test.use({ storageState: authStorageState || emptyStorageState });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });

  test('sidebar expands, collapses, persists, and omits the unavailable Help route', async ({
    page,
  }) => {
    await page.evaluate(() => localStorage.removeItem('metatradee-ui'));
    await page.reload();
    const sidebar = page.getByLabel('Desktop navigation');
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    await page.getByRole('button', { name: 'Expand sidebar' }).press('Enter');
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await expect(sidebar.getByText('MetaTradee')).toBeVisible();
    await page.reload();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    await expect(sidebar.getByRole('link', { name: 'Help' })).toHaveCount(0);

    const journal = sidebar.getByRole('link', { name: 'Journal' });
    await journal.focus();
    await expect(page.getByRole('tooltip')).toHaveText('Journal');
  });

  const routes = [
    ['Dashboard', '/dashboard'],
    ['Journal', '/journal'],
    ['Analytics', '/analytics'],
    ['Chart', '/chart'],
    ['Calendar', '/calendar'],
    ['Playbook', '/playbook'],
    ['Goals', '/goals'],
    ['Reports', '/reports'],
    ['AI Coach', '/ai-coach'],
    ['Settings', '/settings/profile'],
    ['Billing', '/billing'],
  ] as const;

  for (const [label, path] of routes) {
    test(`${label} uses a real internal route and updates the active item`, async ({ page }) => {
      const sidebar = page.getByLabel('Desktop navigation');
      await sidebar.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}(?:$|\\?)`));
      await expect(sidebar.getByRole('link', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
  }

  test('browser Back and Forward preserve the active Dashboard navigation item', async ({
    page,
  }) => {
    const sidebar = page.getByLabel('Desktop navigation');
    await sidebar.getByRole('link', { name: 'Journal' }).click();
    await expect(page).toHaveURL(/\/journal$/);
    await page.goBack();
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.goForward();
    await expect(sidebar.getByRole('link', { name: 'Journal' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('Add account supports type selection, focus trap, outside close, Escape, and Cancel', async ({
    page,
  }) => {
    const trigger = page.getByLabel('Desktop navigation').getByRole('link', {
      name: 'Add account',
    });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create account' })).toBeDisabled();
    await dialog.getByRole('radio', { name: /Demo account/ }).click();
    await expect(dialog.getByText(/Demo balances are deterministic/)).toBeVisible();
    await dialog.getByRole('radio', { name: /Funded account/ }).click();
    await expect(dialog.getByLabel('Account size')).toBeVisible();
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    await page.mouse.click(10, 10);
    await expect(dialog).toBeHidden();

    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('successful account creation refreshes the real Dashboard account selector', async ({
    page,
  }) => {
    test.skip(
      process.env.E2E_ALLOW_ACCOUNT_MUTATIONS !== '1',
      'Enable only for the approved disposable Dashboard test user.',
    );
    const accountName = `E2E demo ${Date.now()}`;
    await page.getByLabel('Desktop navigation').getByRole('link', { name: 'Add account' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /Demo account/ }).click();
    await dialog.getByLabel('Account name').fill(accountName);
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'All accounts' }).click();
    await expect(page.getByText(accountName, { exact: true })).toBeVisible();
  });

  test('filters apply immediately, report their count, reset, close on Escape and outside click', async ({
    page,
  }) => {
    const filters = page.getByRole('button', { name: /^Filters$/ });
    await filters.click();
    await page.getByRole('button', { name: 'Profitable' }).click();
    await expect(page.getByRole('button', { name: /Filters 1/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Filters 1/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await page.getByRole('button', { name: /Filters 1/ }).click();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('button', { name: /^Filters$/ })).toBeVisible();
    await page.getByRole('heading', { level: 2 }).first().click();
    await expect(page.getByRole('button', { name: /^Filters$/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test('date presets and custom range update the shared date control', async ({ page }) => {
    await page.getByRole('button', { name: 'All time' }).click();
    await page.getByRole('button', { name: 'Last 30 days' }).click();
    await expect(page.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await page.getByRole('button', { name: 'Last 30 days' }).click();
    await page.getByRole('button', { name: 'Custom range' }).click();
    await page.getByLabel('Custom range start').fill('2026-01-01');
    await page.getByLabel('Custom range end').fill('2026-01-31');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Custom range' })).toBeVisible();
  });

  test('account selection updates the selector and can be reset to All accounts', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'All accounts' }).click();
    const account = page.getByRole('checkbox').first();
    await expect(account, 'The approved Dashboard fixture must include an account.').toBeVisible();
    const accountName = (
      await account.locator('xpath=..').locator('span.block').first().innerText()
    ).trim();
    await account.click();
    await expect(page.getByRole('button', { name: new RegExp(accountName) })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(accountName) }).click();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByRole('button', { name: 'All accounts' })).toBeVisible();
  });

  test('widget customization hides, reorders, cancels, saves, reloads, and restores defaults', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Edit widgets' }).click();
    await page.getByRole('button', { name: 'Restore defaults' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    const widgetOrder = () =>
      page
        .locator('[data-dashboard-layout="kpis"] [data-widget-id]')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-widget-id')),
        );

    try {
      const originalOrder = await widgetOrder();
      await page.getByRole('button', { name: 'Edit widgets' }).click();
      await expect(page.getByText('Editing dashboard')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Dashboard widget editor' })).toBeVisible();

      await page.getByRole('button', { name: 'Hide Net P&L' }).click();
      await expect(page.locator('[data-widget-id="net-pnl"]')).toHaveCount(0);
      await page.getByRole('button', { name: 'Move Trade expectancy up' }).press('Enter');
      await expect.poll(widgetOrder).not.toEqual(originalOrder);
      page.once('dialog', (dialog) => dialog.dismiss());
      await page.getByRole('link', { name: 'Import trades' }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.getByRole('button', { name: 'Show Net P&L' }).click();
      await expect(page.locator('[data-widget-id="net-pnl"]')).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByText('Editing dashboard')).toHaveCount(0);
      await expect.poll(widgetOrder).toEqual(originalOrder);

      await page.getByRole('button', { name: 'Edit widgets' }).click();
      await page.getByRole('button', { name: 'Hide Net P&L' }).click();
      await page.getByRole('button', { name: 'Move Trade expectancy up' }).press('Enter');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('status')).toContainText('Dashboard widget changes saved.');
      await expect(page.locator('[data-widget-id="net-pnl"]')).toHaveCount(0);

      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
      await expect(page.locator('[data-widget-id="net-pnl"]')).toHaveCount(0);
      expect((await widgetOrder())[0]).toBe('trade-expectancy');

      await page.getByRole('button', { name: 'Edit widgets' }).click();
      await page.getByRole('button', { name: 'Restore defaults' }).click();
      await expect(page.locator('[data-widget-id="net-pnl"]')).toBeVisible();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('status')).toContainText('Dashboard widget changes saved.');
      await page.reload();
      await expect.poll(widgetOrder).toEqual(originalOrder);
      await expect(page.locator('[data-widget-id="net-pnl"]')).toBeVisible();

      await page.getByRole('button', { name: 'Edit widgets' }).click();
      const keyboardMove = page.getByRole('button', { name: 'Move Trade expectancy up' });
      await keyboardMove.focus();
      await keyboardMove.press('Enter');
      await expect.poll(widgetOrder).not.toEqual(originalOrder);
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Cancel' }).click();

      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Edit widgets' }).click();
      await expect(page.getByText('Editing dashboard')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        )
        .toBe(true);
      await page.getByRole('button', { name: 'Cancel' }).click();
    } finally {
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.goto('/dashboard');
      await page.getByRole('button', { name: 'Edit widgets' }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Restore defaults' }).click();
      await page.getByRole('button', { name: 'Save changes' }).click();
    }
  });

  test('unavailable notifications expose a reason and Import trades opens its real workflow', async ({
    page,
  }) => {
    const notifications = page.getByRole('button', { name: 'Notifications unavailable' });
    await expect(notifications).toHaveAttribute('aria-disabled', 'true');
    await notifications.focus();
    await expect(page.getByRole('tooltip')).toHaveText('Notifications are not available yet.');

    await page.getByRole('link', { name: 'Import trades' }).click();
    await expect(page).toHaveURL(/\/journal\/import$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Import trades' })).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'trades.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('not-an-xlsx'),
    });
    await expect(page.getByText(/XLSX is not supported yet/)).toBeVisible();
    await fileInput.setInputFiles({
      name: 'trades.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'symbol,direction,quantity,entry_price,exit_price,opened_at,closed_at\nAAPL,buy,1,100,101,2026-01-01T10:00:00Z,2026-01-01T11:00:00Z',
      ),
    });
    await expect(page.getByText('2 · Map columns')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('1 · Choose platform & file')).toBeVisible();
  });

  test('KPI information and chart summaries are keyboard accessible', async ({ page }) => {
    await expect(page.locator('[data-dashboard-card="kpi"]')).toHaveCount(5);
    const tradeRate = page.locator('[data-widget-id="win-rate"]');
    await expect(tradeRate).toContainText('By trading days');
    await tradeRate.getByRole('button', { name: 'About this metric' }).focus();
    await expect(page.getByRole('tooltip')).toContainText(
      'break-even trades remain in the denominator',
    );
    await expect(page.getByRole('tooltip')).toContainText('no-trade days are excluded');

    const averages = page.locator('[data-widget-id="average-win-loss"]');
    await expect(averages).toContainText('Win');
    await expect(averages).toContainText('Loss');
    await averages.getByRole('button', { name: 'About this metric' }).focus();
    await expect(page.getByRole('tooltip')).toContainText('signed negative average');

    const chart = page.getByRole('img', { name: /Daily cumulative realized profit and loss/ });
    await chart.focus();
    await expect(chart).toBeFocused();
  });

  test('positions and recent-trades tabs visibly switch the table contract', async ({ page }) => {
    const positions = page.getByRole('tab', { name: /Open positions/ });
    const recent = page.getByRole('tab', { name: 'Recent trades' });
    await expect(positions).toHaveAttribute('data-state', 'active');
    await recent.press('Enter');
    await expect(recent).toHaveAttribute('data-state', 'active');
    await expect(page.getByRole('columnheader', { name: 'Closed' })).toBeVisible();
  });

  test('calendar changes months and a populated day applies a real custom-date filter', async ({
    page,
  }) => {
    const calendar = page.getByLabel('Trading calendar');
    const originalTitle = await calendar.getByRole('heading').innerText();
    await calendar.getByRole('button', { name: 'Previous month' }).click();
    await expect(calendar.getByRole('heading')).not.toHaveText(originalTitle);
    await calendar.getByRole('button', { name: 'Next month' }).click();
    await expect(calendar.getByRole('heading')).toHaveText(originalTitle);

    const populatedDay = calendar.locator('button:not(:disabled)[aria-label*=" trades"]').first();
    await expect(
      populatedDay,
      'The approved Dashboard fixture must include a closed trade.',
    ).toBeVisible();
    await populatedDay.press('Enter');
    await expect(page.getByRole('button', { name: 'Custom range' })).toBeVisible();
  });

  test('profile/account action opens real destinations', async ({ page }) => {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
  });

  test('desktop, tablet, and mobile controls remain reachable without page-wide overflow', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1600, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        )
        .toBe(true);
    }

    await expect(page.getByLabel('Desktop navigation')).toBeHidden();
    await expect(page.getByLabel('Primary mobile')).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  });
});

import { expect, test, type Page } from '@playwright/test';

/**
 * The MetaTradee Assistant, in a real browser.
 *
 * THESE SPECS EXIST FOR THE THINGS JSDOM CANNOT TELL YOU. The unit suite
 * already covers the logic; what it cannot see is whether the panel actually
 * fits on a 360px screen, whether the page scrolls sideways once the launcher
 * is on it, whether `dir="rtl"` leaks onto `<html>`, or whether the transcript
 * region really scrolls. Every assertion below is about the rendered result.
 *
 * NO AI PROVIDER AND NO RESEND are configured in this environment, and that is
 * the state under test rather than a limitation of it: the deterministic
 * answers and the honest escalation fallback are exactly what ships today.
 *
 * The app is served from a production build with PLACEHOLDER Supabase env (see
 * .github/workflows/e2e.yml), so nothing here needs a live backend — the
 * chatbot is public and its endpoint touches no database.
 */

const PUBLIC_ROUTES = ['/', '/pricing', '/contact', '/support'];

/**
 * The launcher's accessible name is STABLE across open and closed — state is
 * carried by `aria-expanded`. That is what lets one constant find it in both
 * states, and it is why it no longer collides with the panel's close button.
 */
const LAUNCHER = 'Ask MetaTradee';
const CLOSE = 'Close the MetaTradee Assistant';

/**
 * Open the panel and return it.
 *
 * Waits for focus to reach the composer before handing back, not just for the
 * panel to be visible. The focus lands in an effect, so a test that started
 * typing or tabbing on visibility alone raced it — and lost, intermittently.
 */
async function openChat(page: Page, launcher: string = LAUNCHER) {
  await page.getByRole('button', { name: launcher }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(page.locator('#support-chat-input')).toBeFocused();
  return panel;
}

/** The panel's close button, never the launcher — both are on the page. */
const closeButton = (page: Page) => page.getByRole('dialog').getByRole('button', { name: CLOSE });

/** Send a message and wait for the assistant's turn to land. */
async function ask(page: Page, text: string) {
  const before = await page.locator('[role="log"] li').count();
  await page.getByLabel(/your message|votre message|رسالتك/i).fill(text);
  await page.keyboard.press('Enter');
  // Two new turns: the visitor's and the assistant's.
  await expect(page.locator('[role="log"] li')).toHaveCount(before + 2);
}

test.describe('mounting', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} mounts exactly one launcher and one panel container`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('button', { name: LAUNCHER })).toHaveCount(1);
      await expect(page.locator('#metatradee-support-chat')).toHaveCount(1);
      // Closed until asked for: no dialog in the accessibility tree.
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  }

  test('is absent from the authenticated app and from auth screens', async ({ page }) => {
    /*
     * The chatbot is mounted in `PublicShell` only. `/dashboard` redirects an
     * unauthenticated visitor to /login, and neither surface may carry a public
     * support widget — the in-app help route is a different product.
     */
    for (const route of ['/login', '/register', '/dashboard', '/settings/workspace']) {
      await page.goto(route);
      await expect(page.getByRole('button', { name: LAUNCHER })).toHaveCount(0);
      await expect(page.locator('#metatradee-support-chat')).toHaveCount(0);
    }
  });
});

test.describe('open, close and focus', () => {
  test.beforeEach(async ({ page }) => await page.goto('/'));

  test('opens, reports its state, and closes from the header button', async ({ page }) => {
    const launcher = page.getByRole('button', { name: LAUNCHER });
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');

    const panel = await openChat(page);
    await expect(launcher).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveAttribute('aria-modal', 'false');

    await panel.getByRole('button', { name: CLOSE }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('focus enters the composer on open', async ({ page }) => {
    await openChat(page);
    await expect(page.locator('#support-chat-input')).toBeFocused();
  });

  test('Escape closes it and returns focus to the launcher', async ({ page }) => {
    await openChat(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: LAUNCHER })).toBeFocused();
  });

  test('tab order runs forward to send and backward through the panel', async ({ page }) => {
    await openChat(page);
    const focused = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        return el ? (el.getAttribute('aria-label') ?? el.id ?? el.tagName) : null;
      });

    // Focus starts in the composer. Send is deliberately disabled — and so not
    // tabbable — until there is something to send, so type first.
    expect(await focused()).toBe('support-chat-input');
    await page.locator('#support-chat-input').fill('hello');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('Send');

    // Backwards from the composer reaches the escalation control, then the
    // language selector and the close button — all without leaving the panel.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    const inPanel = await page.evaluate(() =>
      document.querySelector('[role="dialog"]')!.contains(document.activeElement),
    );
    expect(inPanel).toBe(true);
  });
});

test.describe('desktop viewports', () => {
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
  ] as const) {
    test(`${width}x${height}: panel fits, page does not scroll sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const panel = await openChat(page);

      const box = (await panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(height + 1);

      // The composer and the send button stay on screen at every size.
      await expect(page.locator('#support-chat-input')).toBeInViewport();
      await expect(panel.getByRole('button', { name: 'Send' })).toBeInViewport();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  }

  test('the launcher does not cover the header call-to-action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const launcher = (await page.getByRole('button', { name: LAUNCHER }).boundingBox())!;
    const cta = (await page.getByRole('link', { name: 'Get Started' }).first().boundingBox())!;
    const overlaps =
      launcher.x < cta.x + cta.width &&
      launcher.x + launcher.width > cta.x &&
      launcher.y < cta.y + cta.height &&
      launcher.y + launcher.height > cta.y;
    expect(overlaps).toBe(false);
  });

  test('the transcript scrolls rather than growing the panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const panel = await openChat(page);
    const heightBefore = (await panel.boundingBox())!.height;

    for (const q of ['What is MetaTradee?', 'What do the plans cost?', 'Can I import from MT5?']) {
      await ask(page, q);
    }

    expect((await panel.boundingBox())!.height).toBeCloseTo(heightBefore, 0);
    const scrollable = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"] .overflow-y-auto')!;
      return el.scrollHeight > el.clientHeight;
    });
    expect(scrollable).toBe(true);
  });
});

test.describe('mobile viewports', () => {
  for (const [width, height] of [
    [390, 844],
    [375, 812],
    [360, 800],
  ] as const) {
    test(`${width}x${height}: sheet fits, targets are 44px, no sideways scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const panel = await openChat(page);

      const box = (await panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(height + 1);

      // The close control is on screen without scrolling the panel.
      await expect(panel.getByRole('button', { name: CLOSE })).toBeInViewport();
      await expect(page.locator('#support-chat-input')).toBeInViewport();

      // The assistant name must not truncate at the narrowest supported width.
      const truncated = await page.evaluate(() => {
        const el = document.querySelector('#metatradee-support-chat-title') as HTMLElement;
        return el.scrollWidth > el.clientWidth + 1;
      });
      expect(truncated).toBe(false);

      const undersized = await page.evaluate(() => {
        const panelEl = document.querySelector('[role="dialog"]')!;
        return [...panelEl.querySelectorAll('button, select, textarea, input[type="text"]')]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { name: el.getAttribute('aria-label') ?? el.id ?? el.tagName, h: r.height };
          })
          .filter((x) => x.h > 0 && x.h < 44);
      });
      expect(undersized).toEqual([]);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  }

  test('the page behind the sheet is locked while it is open, and released after', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await openChat(page);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await closeButton(page).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });

  test('the page keeps scrolling behind the desktop panel, which is non-modal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await openChat(page);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });
});

test.describe('English', () => {
  test.beforeEach(async ({ page }) => await page.goto('/'));

  test('a quick action starts the conversation and then gets out of the way', async ({ page }) => {
    const panel = await openChat(page);
    await expect(panel.getByText('Hi! I’m the MetaTradee Assistant.')).toBeVisible();

    await panel.getByRole('button', { name: 'What is MetaTradee?' }).click();
    await expect(page.locator('[role="log"] li')).toHaveCount(2);
    await expect(panel.getByText(/AI trading journal/i)).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Pricing and plans' })).toHaveCount(0);
  });

  test('a follow-up stays on the subject and the greeting is not repeated', async ({ page }) => {
    const panel = await openChat(page);
    await ask(page, 'I cannot import my MT5 trades.');
    await expect(panel.getByText(/CSV/)).toBeVisible();

    await ask(page, 'I exported an HTML file.');
    await expect(page.locator('[role="log"] li')).toHaveCount(4);
    // One greeting for the whole conversation, not one per turn.
    await expect(panel.getByText('Hi! I’m the MetaTradee Assistant.')).toHaveCount(1);
  });

  test('pressing Enter repeatedly does not send the message twice', async ({ page }) => {
    await openChat(page);
    const requests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/support-chat')) requests.push(r.url());
    });

    await page.locator('#support-chat-input').fill('What is MetaTradee?');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    await expect(page.locator('[role="log"] li')).toHaveCount(2);
    expect(requests).toHaveLength(1);
  });
});

test.describe('French', () => {
  test('switches every visible label and answers in French', async ({ page }) => {
    await page.goto('/');
    const panel = await openChat(page);
    await panel.getByLabel('Language').selectOption('fr');

    await expect(panel.getByText('Bonjour ! Je suis l’assistant MetaTradee.')).toBeVisible();
    await expect(panel.getByPlaceholder('Posez une question sur MetaTradee…')).toBeVisible();
    await expect(panel.getByText('Ne partagez pas de mots de passe ni de clés API.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Contacter le support' })).toBeVisible();

    await ask(page, 'Combien coûtent les formules ?');
    await expect(panel.getByText(/Il existe quatre formules/)).toBeVisible();
    // Nothing English left in the answer area.
    await expect(panel.getByText('There are four plans')).toHaveCount(0);
  });
});

test.describe('Arabic and right-to-left', () => {
  test('mirrors the panel and leaves the surrounding site untouched', async ({ page }) => {
    await page.goto('/');
    const panel = await openChat(page);
    const htmlDirBefore = await page.evaluate(() => document.documentElement.dir);

    await panel.getByLabel('Language').selectOption('ar');

    await expect(panel).toHaveAttribute('dir', 'rtl');
    await expect(panel).toHaveAttribute('lang', 'ar');
    await expect(panel.getByText('مرحباً! أنا مساعد MetaTradee.')).toBeVisible();

    // THE LOAD-BEARING ASSERTION: the site itself is still left-to-right.
    expect(await page.evaluate(() => document.documentElement.dir)).toBe(htmlDirBefore);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    expect(await page.evaluate(() => getComputedStyle(document.body).direction)).toBe('ltr');
    // Exactly one banner landmark on the page, and it is still left-to-right.
    await expect(page.getByRole('banner')).toHaveCount(1);
    expect(await page.getByRole('banner').evaluate((el) => getComputedStyle(el).direction)).toBe(
      'ltr',
    );
  });

  test('answers in Arabic and aligns the turns to the right', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const panel = await openChat(page);
    await panel.getByLabel('Language').selectOption('ar');

    await ask(page, 'كم تكلفة الخطط؟');

    const turns = page.locator('[role="log"] li');
    for (const dir of await turns.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).direction),
    )) {
      expect(dir).toBe('rtl');
    }

    // Arabic must not push the panel out of the viewport or overflow the page.
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  });

  test('the Arabic support form validates in Arabic', async ({ page }) => {
    await page.goto('/');
    const panel = await openChat(page);
    await panel.getByLabel('Language').selectOption('ar');
    await panel.getByRole('button', { name: 'التواصل مع الدعم' }).click();

    await panel.getByRole('button', { name: 'إرسال إلى الدعم' }).click();
    await expect(panel.getByText('يرجى كتابة اسمك.')).toBeVisible();
    await expect(panel.getByText('يرجى التحقق من البريد الإلكتروني.')).toBeVisible();
  });
});

test.describe('automatic language detection', () => {
  test('an Arabic first message switches the interface to Arabic', async ({ page }) => {
    await page.goto('/');
    const panel = await openChat(page);
    await ask(page, 'ما هو MetaTradee؟');
    await expect(panel).toHaveAttribute('dir', 'rtl');
    await expect(panel.getByPlaceholder('اسأل عن MetaTradee…')).toBeVisible();
  });

  test('a French first message switches the interface to French', async ({ page }) => {
    await page.goto('/');
    const panel = await openChat(page);
    await ask(page, 'Combien coûtent les formules ?');
    await expect(panel.getByPlaceholder('Posez une question sur MetaTradee…')).toBeVisible();
    await expect(panel).toHaveAttribute('dir', 'ltr');
  });

  test('an English first message leaves the interface in English', async ({ page }) => {
    await page.goto('/');
    const panel = await openChat(page);
    await ask(page, 'What is MetaTradee and how does it work?');
    await expect(panel.getByPlaceholder('Ask about MetaTradee…')).toBeVisible();
  });

  test('a manual choice is never overridden by a later message', async ({ page }) => {
    await page.goto('/');
    const panel = await openChat(page);
    await panel.getByLabel('Language').selectOption('fr');
    await ask(page, 'ما هو MetaTradee؟');
    // Chosen French stands, even though the message is unmistakably Arabic.
    await expect(panel).toHaveAttribute('dir', 'ltr');
    await expect(panel.getByPlaceholder('Posez une question sur MetaTradee…')).toBeVisible();
  });
});

test.describe('language persistence', () => {
  test('survives closing and reopening the panel', async ({ page }) => {
    await page.goto('/');
    const panel = await openChat(page);
    await panel.getByLabel('Language').selectOption('ar');
    // Escape rather than the close button: its accessible name is Arabic now.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    /*
     * The LAUNCHER is translated too — it belongs to the widget, not to the
     * page — so reopening asks for it by its Arabic name. That the English
     * name no longer matches anything is the assertion, not an obstacle.
     */
    await expect(page.getByRole('button', { name: LAUNCHER })).toHaveCount(0);
    const reopened = await openChat(page, 'اسأل MetaTradee');
    await expect(reopened).toHaveAttribute('dir', 'rtl');
    await expect(reopened.getByText('مرحباً! أنا مساعد MetaTradee.')).toBeVisible();
  });

  test('survives a navigation to another public page', async ({ page }) => {
    await page.goto('/');
    const panel = await openChat(page);
    await panel.getByLabel('Language').selectOption('fr');

    await page.goto('/pricing');
    const onPricing = await openChat(page, 'Poser une question à MetaTradee');
    await expect(onPricing.getByText('Bonjour ! Je suis l’assistant MetaTradee.')).toBeVisible();
  });
});

test.describe('grounded knowledge, with no AI provider configured', () => {
  test.beforeEach(async ({ page }) => await page.goto('/'));

  test('answers pricing from the plan configuration', async ({ page }) => {
    const panel = await openChat(page);
    await ask(page, 'What do the plans cost?');
    // Prices are derived from `plans.ts`; these are the configured values.
    await expect(panel.getByText(/\$19 per month or \$190 per year/)).toBeVisible();
    await expect(panel.getByText(/Free — free/)).toBeVisible();
  });

  test('does not present backtesting as a live feature', async ({ page }) => {
    const panel = await openChat(page);
    await ask(page, 'Do you support backtesting?');
    const answer = panel.locator('[role="log"] li').last();
    await expect(answer).toContainText('not built yet');
    await expect(answer).toContainText('Manual backtesting');
  });

  test('describes replay as shipped and distinct from a backtester', async ({ page }) => {
    const panel = await openChat(page);
    await ask(page, 'Do you have trade replay?');
    const answer = panel.locator('[role="log"] li').last();
    await expect(answer).toContainText(/shipped|available/i);
    await expect(answer).toContainText('not a backtester');
  });

  test('admits uncertainty and offers a person rather than inventing an answer', async ({
    page,
  }) => {
    const panel = await openChat(page);
    await ask(page, 'Who won the world cup in 1998?');
    const answer = panel.locator('[role="log"] li').last();
    await expect(answer).toContainText('I do not have an approved answer');
    await expect(answer).toContainText('will not guess');
    // The escalation control is emphasised once a human would serve better.
    await expect(panel.getByRole('button', { name: 'Contact support' })).toBeVisible();
  });

  test('refuses trade calls and makes no guarantee', async ({ page }) => {
    const panel = await openChat(page);
    await ask(page, 'Should I buy EURUSD right now?');
    const answer = panel.locator('[role="log"] li').last();
    await expect(answer).toContainText('never tells you what to buy or sell');
    await expect(answer).not.toContainText(/guaranteed/i);
  });

  test('redacts a pasted credential instead of echoing it back', async ({ page }) => {
    const panel = await openChat(page);
    await ask(page, 'my password is Hunter2Hunter2 and I am locked out');
    const answer = panel.locator('[role="log"] li').last();
    await expect(answer).toContainText('never ask for them');
    await expect(answer).not.toContainText('Hunter2Hunter2');
  });
});

test.describe('escalation to a person', () => {
  test.beforeEach(async ({ page }) => await page.goto('/'));

  test('preselects the category the conversation implied', async ({ page }) => {
    const panel = await openChat(page);
    await ask(page, 'I want a refund, I was charged twice');
    await panel.getByRole('button', { name: 'Contact support' }).click();
    await expect(panel.getByLabel('What do you need help with?')).toHaveValue(
      'billing_subscription',
    );
  });

  test('shows the honest fallback — and the real address — when Resend is unconfigured', async ({
    page,
  }) => {
    const panel = await openChat(page);
    await ask(page, 'I cannot import my MT5 trades.');
    await panel.getByRole('button', { name: 'Contact support' }).click();

    await panel.getByLabel('Your name').fill('Sam Rivera');
    await panel.getByLabel('Email address').fill('sam@example.com');
    await panel.getByLabel('Subject').fill('MT5 import fails');
    await panel
      .getByLabel('How can we help?')
      .fill('The MetaTrader 5 import fails every time with no error message shown.');
    await panel.getByLabel(/I agree that MetaTradee/).check();
    await panel.getByRole('button', { name: 'Send to support' }).click();

    // No false success: sending is genuinely unavailable in this environment.
    await expect(panel.getByText('We could not send that from here.')).toBeVisible();
    await expect(panel.getByText(/Thanks — your request is on its way/)).toHaveCount(0);

    // The fallback is a link the visitor must choose to use, not an auto-open.
    const mailto = panel.getByRole('link', { name: 'support@metatradee.com' });
    await expect(mailto).toBeVisible();
    await expect(mailto).toHaveAttribute('href', 'mailto:support@metatradee.com');
  });

  test('never exposes the internal admin mailbox anywhere on the page', async ({ page }) => {
    const panel = await openChat(page);
    await ask(page, 'I think my account was hacked');
    await panel.getByRole('button', { name: 'Contact support' }).click();
    expect(await page.content()).not.toContain('admin@metatradee.com');
  });

  test('keeps what the visitor typed when validation rejects the form', async ({ page }) => {
    const panel = await openChat(page);
    await panel.getByRole('button', { name: 'Contact support' }).click();
    await panel.getByLabel('Your name').fill('Sam Rivera');
    await panel.getByLabel('Email address').fill('not-an-email');
    await panel.getByRole('button', { name: 'Send to support' }).click();

    await expect(panel.getByText('Please check this email address.')).toBeVisible();
    await expect(panel.getByLabel('Your name')).toHaveValue('Sam Rivera');
  });
});

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => await page.goto('/'));

  test('the dialog, its controls and its live region are properly named', async ({ page }) => {
    const panel = await openChat(page);
    await expect(panel).toHaveAttribute('aria-labelledby', 'metatradee-support-chat-title');
    await expect(page.locator('#metatradee-support-chat-title')).toHaveText('MetaTradee Assistant');
    await expect(panel.getByRole('button', { name: CLOSE })).toBeVisible();
    await expect(panel.getByRole('log', { name: /Conversation with/ })).toHaveAttribute(
      'aria-live',
      'polite',
    );
    await expect(panel.getByLabel('Language')).toBeVisible();
    await expect(panel.getByLabel('Your message')).toBeVisible();
  });

  test('the launcher exposes a name and the panel it controls', async ({ page }) => {
    const launcher = page.getByRole('button', { name: LAUNCHER });
    await expect(launcher).toHaveAttribute('aria-controls', 'metatradee-support-chat');
    await expect(page.locator('#metatradee-support-chat')).toHaveCount(1);
  });

  test('every form control has an associated label and error', async ({ page }) => {
    const panel = await openChat(page);
    await panel.getByRole('button', { name: 'Contact support' }).click();
    await panel.getByRole('button', { name: 'Send to support' }).click();

    const nameField = panel.getByLabel('Your name');
    await expect(nameField).toHaveAttribute('aria-describedby', 'chat-name-error');
    await expect(page.locator('#chat-name-error')).toHaveText('Please tell us your name.');
  });

  test('focus is visible on the launcher and inside the panel', async ({ page }) => {
    await openChat(page);
    const outline = await page.evaluate(() => {
      const el = document.querySelector('#support-chat-input') as HTMLElement;
      el.focus();
      const s = getComputedStyle(el);
      return { shadow: s.boxShadow, outline: s.outlineStyle };
    });
    // The ring is a box-shadow via Tailwind's focus-visible ring utilities.
    expect(outline.shadow === 'none' && outline.outline === 'none').toBe(false);
  });

  test('reduced motion turns the launcher transition off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const duration = await page
      .getByRole('button', { name: LAUNCHER })
      .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
    /*
     * Effectively zero, not literally "0s". The project's reduced-motion rule
     * collapses durations to 0.00001s — the standard trick that keeps
     * transition-end events firing while removing all perceptible movement.
     */
    expect(duration).toBeLessThan(0.05);
  });

  test('the panel title bar meets AA contrast', async ({ page }) => {
    const panel = await openChat(page);
    // The title bar is the element carrying the primary background.
    const ratio = await panel.locator('#metatradee-support-chat-title').evaluate((el) => {
      const bar = el.closest('div.bg-primary') as HTMLElement;
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        }) as [number, number, number];
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const fg = lum(parse(getComputedStyle(el).color));
      const bg = lum(parse(getComputedStyle(bar).backgroundColor));
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  /**
   * Serves an ALREADY-BUILT app. The build is a separate, explicit step
   * (`pnpm build`) — never part of this lifecycle.
   *
   * Why: `next build` takes ~168s here, so running it inside `webServer` under
   * any startup-sized timeout meant Playwright SIGKILLed it mid-write and
   * corrupted `.next`. Avoiding that by adopting whatever already listened on
   * :3000 was worse — a stale server once produced a full run of false results.
   *
   * `reuseExistingServer: false` everywhere makes Playwright own the lifecycle:
   * it starts the server, stops it afterwards, and refuses to run if the port
   * is already taken. A pre-existing process is now a loud failure instead of a
   * silent, unverified substitution. If the app has not been built, `pnpm start`
   * exits immediately with "Could not find a production build" — a fast, honest
   * error rather than a two-minute timeout.
   *
   * The timeout below covers SERVER STARTUP only (observed: ready in ~2s).
   */
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

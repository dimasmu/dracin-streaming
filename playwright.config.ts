import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4300);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Playwright configuration for the two UI regressions that were reported:
 *  - the navbar active underline pointing at the wrong item after navigating
 *    from somewhere other than the navbar;
 *  - the hover preview lingering (not fading out) across scroll / navigation.
 *
 * The app is served by `ng serve` on a dedicated port so a developer server
 * already running on :4200 is left untouched.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // The preview only opens for devices that report hover capability.
    hasTouch: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
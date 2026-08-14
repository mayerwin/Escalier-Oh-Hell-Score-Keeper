import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 8000;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The app ships with no runtime dependencies; Playwright is a dev-only tool.
 *
 * The suite runs against the real static server rather than a bundler dev
 * server, because that is exactly what GitHub Pages serves — service worker,
 * relative paths and all.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // A phone is the app's home ground; individual specs override this where
    // they are checking desktop behaviour.
    viewport: { width: 400, height: 850 },
    locale: 'en-GB',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 400, height: 850 } } }],

  webServer: {
    command: `node tools/serve.mjs ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

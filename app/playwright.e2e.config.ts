/**
 * Playwright configuration for Chrome extension E2E testing.
 *
 * Chrome extensions require a persistent browser context with the extension
 * loaded via --load-extension, which means:
 * - Only Chromium is supported (Firefox/WebKit don't support --load-extension)
 * - Headless mode is not supported — CI runs under xvfb
 * - The extension must be built first: `pnpm build`, then `pnpm test:e2e`
 *
 * Adapted from the Aurelius chrome-extension template (battle-tested against
 * a published Chrome Web Store extension).
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false, // one persistent extension context at a time
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chrome-extension" }],
});

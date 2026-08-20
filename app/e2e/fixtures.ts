/**
 * Playwright fixtures for testing the built Optia extension.
 *
 * Provides:
 * - extensionContext: persistent Chromium context with the extension loaded
 * - extensionId: the extension's ID, resolved from the service worker URL
 * - extensionServiceWorker: the MV3 background service worker
 * - sidePanelPage: the side panel UI opened as a page
 * - optionsPage: the options UI opened as a page
 *
 * Requires a build in ./dist (override with EXTENSION_PATH).
 */

import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";
import { resolve } from "path";

const EXTENSION_DIR = resolve(process.env.EXTENSION_PATH || "./dist");

interface ExtensionFixtures {
  extensionContext: BrowserContext;
  extensionId: string;
  extensionServiceWorker: Worker;
  sidePanelPage: Page;
  optionsPage: Page;
}

async function serviceWorkerFor(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers();
  if (existing.length > 0) return existing[0];
  return context.waitForEvent("serviceworker", { timeout: 10_000 });
}

export const test = base.extend<ExtensionFixtures>({
  extensionContext: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-default-apps",
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ extensionContext }, use) => {
    const worker = await serviceWorkerFor(extensionContext);
    const match = worker.url().match(/chrome-extension:\/\/([^/]+)/);
    if (!match) {
      throw new Error(`Could not extract extension ID from service worker URL: ${worker.url()}`);
    }
    await use(match[1]);
  },

  extensionServiceWorker: async ({ extensionContext }, use) => {
    await use(await serviceWorkerFor(extensionContext));
  },

  // Optia has no popup — the action opens a side panel. Its page can still be
  // loaded directly for UI assertions.
  sidePanelPage: async ({ extensionContext, extensionId }, use) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`, {
      waitUntil: "domcontentloaded",
    });
    await use(page);
    await page.close();
  },

  optionsPage: async ({ extensionContext, extensionId }, use) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`, {
      waitUntil: "domcontentloaded",
    });
    await use(page);
    await page.close();
  },
});

export { expect } from "@playwright/test";

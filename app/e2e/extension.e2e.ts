/**
 * Optia extension E2E — loads the built extension into real Chromium and
 * exercises the pieces a store reviewer (or user) hits first: install, the
 * service worker, the side panel UI, the options UI, storage, and the
 * content script on a live page.
 */

import { test, expect } from "./fixtures";

test.describe("Extension loading", () => {
  test("extension loads with the pinned ID", async ({ extensionId }) => {
    // The manifest `key` makes this ID deterministic; the backend CORS
    // allowlist and the store listing both assume it.
    expect(extensionId).toBe("lgkgkmjldppeidgafolhfpepmabnnbhe");
  });

  test("service worker answers PING", async ({ optionsPage }) => {
    const response = await optionsPage.evaluate(
      () =>
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: "PING" }, (res) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
            else resolve(res);
          });
        }),
    );
    expect(response).toMatchObject({ pong: true });
  });
});

test.describe("Side panel UI", () => {
  test("renders the setup screen", async ({ sidePanelPage }) => {
    await expect(
      sidePanelPage.getByRole("heading", { name: /set up your seo analysis/i }),
    ).toBeVisible();
    await expect(sidePanelPage.getByLabel(/main keyword/i)).toBeVisible();
    await expect(sidePanelPage.getByRole("button", { name: /optimize my seo/i })).toBeVisible();
  });

  test("analyze button is disabled until a keyword is entered", async ({ sidePanelPage }) => {
    const button = sidePanelPage.getByRole("button", { name: /optimize my seo/i });
    await expect(button).toBeDisabled();
    await sidePanelPage.getByLabel(/main keyword/i).fill("seo tools");
    await expect(button).toBeEnabled();
  });
});

test.describe("Options UI", () => {
  test("renders settings and the license card", async ({ optionsPage }) => {
    await expect(optionsPage.getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(optionsPage.getByRole("heading", { name: /license/i })).toBeVisible();
    // A fresh install is on the free tier.
    await expect(optionsPage.getByText("Free", { exact: true })).toBeVisible();
  });

  test("free tier gates the Anthropic key behind Pro", async ({ optionsPage }) => {
    await expect(optionsPage.getByText("Free", { exact: true })).toBeVisible();
    await expect(optionsPage.getByLabel(/anthropic api key/i)).toHaveCount(0);
  });
});

test.describe("Chrome storage", () => {
  test("round-trips through chrome.storage.local", async ({ extensionServiceWorker }) => {
    const result = await extensionServiceWorker.evaluate(async () => {
      await chrome.storage.local.set({ __e2e_probe: "ok" });
      const data = await chrome.storage.local.get("__e2e_probe");
      await chrome.storage.local.remove("__e2e_probe");
      return data.__e2e_probe;
    });
    expect(result).toBe("ok");
  });
});

test.describe("Content script", () => {
  test("injects and extracts SEO data from a live page", async ({
    extensionContext,
    extensionServiceWorker,
  }) => {
    const page = await extensionContext.newPage();
    await page.goto("https://example.com", { waitUntil: "load" });

    // Ask the service worker to message the tab's content script the same way
    // the side panel does. Retry briefly — injection lands at document_idle.
    const data = await extensionServiceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: "https://example.com/" });
      const tabId = tabs[0]?.id;
      if (!tabId) throw new Error("test tab not found");
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const response = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_SEO_DATA" });
          if (response?.data) return response.data;
        } catch {
          // Content script not ready yet
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error("content script never responded");
    });

    expect(data).toMatchObject({ title: "Example Domain" });
    await page.close();
  });
});

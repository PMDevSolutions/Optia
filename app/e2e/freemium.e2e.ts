/**
 * Freemium-flow E2E (issue #16): free tier, over-quota, upgrade/claim, and
 * error paths, against the BUILT extension with the backend mocked at the
 * network layer (context.route) — no real backend or Stripe traffic.
 *
 * Deliberately NOT covered here: the ready→activate Pro unlock and the
 * downgrade path. Activation verifies an Ed25519-signed entitlement against
 * the JWKS baked into the build, and the signing key correctly never leaves
 * the server — so a mocked /license/activate response can never verify.
 * Those paths are covered by the unit suites (checkout-store, entitlement,
 * entitlement-store truth table) and by the manual staging QA checklist
 * (docs/qa-checklist-v1.md).
 */

import { test, expect } from "./fixtures";
import type { BrowserContext, Page, Worker } from "@playwright/test";

const BACKEND_GLOB = "**/api.optia-api.com/**";
const PANEL_PATH = "src/sidepanel/index.html";
const OPTIONS_PATH = "src/options/index.html";

const currentPeriod = () => new Date().toISOString().slice(0, 7);

interface ErrorLog {
  pageErrors: string[];
  consoleErrors: string[];
}

/** Attach uncaught-exception and console-error collectors to a page. */
function watchErrors(page: Page): ErrorLog {
  const log: ErrorLog = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", (err) => log.pageErrors.push(String(err)));
  page.on("console", (msg) => {
    // "Failed to load resource" lines are produced by intentionally aborted /
    // failed mock routes; uncaught crashes surface via pageerror instead.
    if (msg.type() === "error" && !/Failed to load resource/i.test(msg.text())) {
      log.consoleErrors.push(msg.text());
    }
  });
  return log;
}

async function openPage(context: BrowserContext, extensionId: string, path: string) {
  const page = await context.newPage();
  const errors = watchErrors(page);
  await page.goto(`chrome-extension://${extensionId}/${path}`, { waitUntil: "domcontentloaded" });
  return { page, errors };
}

async function seedStorage(worker: Worker, items: Record<string, unknown>): Promise<void> {
  await worker.evaluate(async (data) => {
    await chrome.storage.local.set(data);
  }, items);
}

async function readStorage<T>(worker: Worker, key: string): Promise<T | undefined> {
  return worker.evaluate(async (k) => {
    const data = await chrome.storage.local.get(k);
    return data[k] as never;
  }, key) as Promise<T | undefined>;
}

test.describe("Free tier", () => {
  test("fresh install shows onboarding once, then hydrates as Free — no console errors", async ({
    extensionContext,
    extensionId,
  }) => {
    const unexpected: string[] = [];
    await extensionContext.route(BACKEND_GLOB, (route) => {
      unexpected.push(route.request().url());
      void route.fulfill({ status: 500, body: "unexpected" });
    });

    const { page, errors } = await openPage(extensionContext, extensionId, PANEL_PATH);

    // First run: the onboarding overlay appears and dismisses cleanly.
    const getStarted = page.getByRole("button", { name: /get started/i });
    await expect(getStarted).toBeVisible();
    await getStarted.click();
    await expect(getStarted).toBeHidden();

    await expect(page.getByRole("button", { name: /upgrade/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /set up your seo analysis/i })).toBeVisible();

    expect(unexpected, "a fresh free install must not call the backend on load").toEqual([]);
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
    await page.close();
  });

  test("over-quota free tier surfaces the exhausted allowance and the upgrade path", async ({
    extensionContext,
    extensionId,
    extensionServiceWorker,
  }) => {
    await seedStorage(extensionServiceWorker, {
      free_ai_quota: { period: currentPeriod(), remaining: 0, limit: 25 },
    });

    const options = await openPage(extensionContext, extensionId, OPTIONS_PATH);
    await expect(options.page.getByText(/free ai quota this month: 0 of 25 remaining/i)).toBeVisible();

    const panel = await openPage(extensionContext, extensionId, PANEL_PATH);
    await expect(panel.page.getByRole("button", { name: /upgrade/i })).toBeVisible();

    expect(options.errors.pageErrors).toEqual([]);
    expect(panel.errors.pageErrors).toEqual([]);
    await options.page.close();
    await panel.page.close();
  });

  test("a corrupt/expired entitlement token degrades to Free without crashing", async ({
    extensionContext,
    extensionId,
    extensionServiceWorker,
  }) => {
    await seedStorage(extensionServiceWorker, {
      entitlement_token: "not.a.valid.jws",
      license_key: "optia_live_stale",
    });

    const options = await openPage(extensionContext, extensionId, OPTIONS_PATH);
    await expect(options.page.getByText("Free", { exact: true })).toBeVisible();
    await expect(options.page.getByLabel(/license key/i)).toBeVisible();

    expect(options.errors.pageErrors).toEqual([]);
    await options.page.close();
  });
});

test.describe("Upgrade flow (mocked backend)", () => {
  test("checkout opens, the claim polls, and an expired claim falls back to manual entry", async ({
    extensionContext,
    extensionId,
    extensionServiceWorker,
  }) => {
    const checkoutBodies: Array<Record<string, unknown>> = [];
    let sessionState: "pending" | "gone" = "pending";

    await extensionContext.route("**checkout.stripe.com/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>Stripe stub</title>ok" }),
    );
    await extensionContext.route(BACKEND_GLOB, (route) => {
      const url = route.request().url();
      if (url.includes("/billing/checkout")) {
        checkoutBodies.push(route.request().postDataJSON() as Record<string, unknown>);
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            url: "https://checkout.stripe.com/c/pay/e2e-stub",
            sessionId: "cs_test_e2e_claim",
          }),
        });
      }
      if (url.includes("/billing/session/cs_test_e2e_claim")) {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ status: sessionState }),
        });
      }
      return route.fulfill({ status: 500, body: "unexpected route" });
    });

    await seedStorage(extensionServiceWorker, { onboarding_dismissed: true });
    const { page, errors } = await openPage(extensionContext, extensionId, PANEL_PATH);
    await page.getByRole("button", { name: /upgrade/i }).click();

    // Paywall shows the real plan catalog.
    await expect(page.getByRole("radio", { name: /monthly/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /annual/i })).toBeVisible();
    await expect(page.getByText("$5", { exact: true })).toBeVisible();
    await expect(page.getByText("$50", { exact: true })).toBeVisible();
    await expect(page.getByText(/2 months free/i)).toBeVisible();

    await page.getByRole("button", { name: /continue to checkout/i }).click();

    // Claim state machine: polling UI + persisted pending session.
    await expect(page.getByText(/waiting for payment confirmation/i)).toBeVisible();
    await expect
      .poll(async () => readStorage<{ sessionId: string }>(extensionServiceWorker, "pending_checkout"))
      .toMatchObject({ sessionId: "cs_test_e2e_claim" });

    expect(checkoutBodies).toHaveLength(1);
    expect(checkoutBodies[0].priceId).toMatch(/^price_/);
    expect(typeof checkoutBodies[0].installId).toBe("string");

    // Claim expiry (single-use "gone") → friendly fallback to manual key entry.
    sessionState = "gone";
    await expect(page.getByRole("alert")).toContainText(/expired.*license key.*options/is, {
      timeout: 15_000,
    });
    await expect
      .poll(async () => readStorage(extensionServiceWorker, "pending_checkout"))
      .toBeUndefined();

    expect(errors.pageErrors).toEqual([]);
    await page.close();
  });

  test("backend 5xx and offline failures show a friendly retryable error", async ({
    extensionContext,
    extensionId,
    extensionServiceWorker,
  }) => {
    let mode: "server" | "offline" = "server";
    await extensionContext.route(BACKEND_GLOB, (route) => {
      if (mode === "server") {
        return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      }
      return route.abort("internetdisconnected");
    });

    await seedStorage(extensionServiceWorker, { onboarding_dismissed: true });
    const { page, errors } = await openPage(extensionContext, extensionId, PANEL_PATH);
    await page.getByRole("button", { name: /upgrade/i }).click();
    await page.getByRole("button", { name: /continue to checkout/i }).click();

    await expect(page.getByRole("alert")).toContainText(/could not start checkout/i);
    const tryAgain = page.getByRole("button", { name: /try again/i });
    await expect(tryAgain).toBeVisible();

    mode = "offline";
    await tryAgain.click();
    await expect(page.getByRole("alert")).toContainText(/could not start checkout/i);

    expect(errors.pageErrors).toEqual([]);
    await page.close();
  });

  test("rate limiting surfaces the retry-after hint", async ({
    extensionContext,
    extensionId,
    extensionServiceWorker,
  }) => {
    await extensionContext.route(BACKEND_GLOB, (route) =>
      route.fulfill({
        status: 429,
        headers: { "Retry-After": "30" },
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Too many billing requests." } }),
      }),
    );

    await seedStorage(extensionServiceWorker, { onboarding_dismissed: true });
    const { page, errors } = await openPage(extensionContext, extensionId, PANEL_PATH);
    await page.getByRole("button", { name: /upgrade/i }).click();
    await page.getByRole("button", { name: /continue to checkout/i }).click();

    await expect(page.getByRole("alert")).toContainText(/too many attempts.*30s/is);
    expect(errors.pageErrors).toEqual([]);
    await page.close();
  });
});

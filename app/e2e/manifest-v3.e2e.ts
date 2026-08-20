/**
 * Manifest V3 compliance suite — a pre-submission check against the rules the
 * Chrome Web Store review enforces. Runs against the BUILT manifest in ./dist
 * (crxjs rewrites paths at build time, so the shipped manifest is what must
 * comply, not the source one).
 */

import { test, expect } from "./fixtures";
import { readFileSync } from "fs";
import { resolve } from "path";

const EXTENSION_DIR = resolve(process.env.EXTENSION_PATH || "./dist");

function loadManifest(): Record<string, unknown> {
  const raw = readFileSync(resolve(EXTENSION_DIR, "manifest.json"), "utf-8");
  return JSON.parse(raw);
}

test.describe("Manifest V3 structure", () => {
  const manifest = loadManifest();

  test("uses manifest_version 3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test("has the required identity fields", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.description).toBeTruthy();
    expect((manifest.description as string).length).toBeLessThanOrEqual(132); // CWS limit
  });

  test("ships the full icon set", () => {
    const icons = manifest.icons as Record<string, string>;
    for (const size of ["16", "32", "48", "128"]) {
      expect(icons, `icon-${size} must be declared`).toHaveProperty(size);
    }
  });

  test("uses a service worker, not a background page", () => {
    const background = manifest.background as Record<string, unknown>;
    expect(background).toHaveProperty("service_worker");
    expect(background).not.toHaveProperty("page");
    expect(background).not.toHaveProperty("scripts");
  });

  test("uses the action API (not browserAction/pageAction)", () => {
    expect(manifest).not.toHaveProperty("browser_action");
    expect(manifest).not.toHaveProperty("page_action");
    expect(manifest).toHaveProperty("action");
  });

  test("declares the side panel entry point", () => {
    const sidePanel = manifest.side_panel as Record<string, string>;
    expect(sidePanel?.default_path).toBeTruthy();
    expect((manifest.permissions as string[]) ?? []).toContain("sidePanel");
  });

  test("host patterns live in host_permissions, not permissions", () => {
    const permissions = (manifest.permissions as string[]) ?? [];
    const hostPatterns = permissions.filter(
      (p) => p.includes("://") || p === "<all_urls>" || p.startsWith("*://"),
    );
    expect(hostPatterns).toHaveLength(0);
  });

  test("content_security_policy (if set) uses the MV3 object format", () => {
    const csp = manifest.content_security_policy;
    if (csp) {
      expect(typeof csp).toBe("object");
      expect(csp).toHaveProperty("extension_pages");
    }
  });

  test("web_accessible_resources (if set) use the MV3 format", () => {
    const war = manifest.web_accessible_resources as unknown[] | undefined;
    if (war && war.length > 0) {
      const first = war[0] as Record<string, unknown>;
      expect(first).toHaveProperty("resources");
      expect(first).toHaveProperty("matches");
    }
  });

  test("pins the extension ID via the manifest key", () => {
    // The `key` field makes the extension ID deterministic across local loads
    // and the store listing — the backend's CORS allowlist depends on it.
    expect(manifest.key).toBeTruthy();
  });
});

test.describe("MV3 service worker runtime", () => {
  test("service worker registers and is reachable", async ({ extensionServiceWorker }) => {
    expect(extensionServiceWorker.url()).toContain("chrome-extension://");
  });

  test("declared APIs are actually available to the worker", async ({
    extensionServiceWorker,
  }) => {
    const manifest = loadManifest();
    const permissions = (manifest.permissions as string[]) ?? [];
    const available = await extensionServiceWorker.evaluate(() => ({
      storage: typeof chrome.storage !== "undefined",
      tabs: typeof chrome.tabs !== "undefined",
      alarms: typeof chrome.alarms !== "undefined",
      sidePanel: typeof chrome.sidePanel !== "undefined",
      action: typeof chrome.action !== "undefined",
      onMessage: typeof chrome.runtime.onMessage !== "undefined",
    }));

    expect(available.onMessage).toBe(true);
    expect(available.action).toBe(true);
    if (permissions.includes("storage")) expect(available.storage).toBe(true);
    if (permissions.includes("tabs")) expect(available.tabs).toBe(true);
    if (permissions.includes("alarms")) expect(available.alarms).toBe(true);
    if (permissions.includes("sidePanel")) expect(available.sidePanel).toBe(true);
  });
});

#!/usr/bin/env node
// Capture real Optia UI states for the store screenshots.
//
// Dev-preview states (setup, score view, paywall) need `pnpm dev` running in
// app/ first; the options/license capture loads the built extension from
// app/dist (run `pnpm build` first). Captures land in
// marketing/store-assets/templates/captures/ so screenshot-frame.html can
// reference them relatively via --param shot=captures/<name>.png.
//
// Usage: node marketing/store-assets/capture.mjs [--skip-dev] [--skip-ext]

import { createRequire } from "module";
import path from "path";
import fs from "fs";

const require = createRequire(new URL("../../app/package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const OUT_DIR = new URL("./templates/captures/", import.meta.url).pathname;
fs.mkdirSync(OUT_DIR, { recursive: true });
const DEV_URL = process.env.DEV_URL || "http://localhost:5173/dev.html";
const EXTENSION_DIR = path.resolve(new URL("../../app/dist", import.meta.url).pathname);

const skipDev = process.argv.includes("--skip-dev");
const skipExt = process.argv.includes("--skip-ext");

async function shoot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`captured ${name}.png`);
}

if (!skipDev) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 440, height: 760 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // 0/1. Welcome modal (first run), then the setup screen behind it
  await page.goto(DEV_URL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /set up your seo analysis/i }).waitFor();
  const getStarted = page.getByRole("button", { name: /get started/i });
  if (await getStarted.isVisible().catch(() => false)) {
    await shoot(page, "welcome");
    await getStarted.click();
    await page.waitForTimeout(400);
  }
  await shoot(page, "setup");

  // 2. Score view — run a real local analysis against a stable public page
  await page.getByLabel(/page url to analyze/i).fill("https://en.wikipedia.org/wiki/Search_engine_optimization");
  await page.getByLabel(/main keyword/i).fill("search engine optimization");
  await page.getByRole("button", { name: /optimize my seo/i }).click();
  await page.waitForSelector("text=/SEO Score|score/i", { timeout: 30_000 });
  await page.waitForTimeout(1500); // let the gauge animation settle
  await shoot(page, "score");

  // 3. Paywall / Pro upgrade surface
  await page.getByRole("button", { name: /upgrade/i }).first().click();
  await page.waitForTimeout(600);
  await shoot(page, "paywall");

  await browser.close();
}

if (!skipExt) {
  // 4. Options page with the license card, from the real built extension
  const ctx = await chromium.launchPersistentContext("", {
    headless: false,
    viewport: { width: 440, height: 760 },
    deviceScaleFactor: 2,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      "--no-first-run",
    ],
  });
  const worker =
    ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker", { timeout: 10_000 }));
  const extensionId = worker.url().match(/chrome-extension:\/\/([^/]+)/)[1];
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: /license/i }).waitFor();
  await shoot(page, "options");
  await ctx.close();
}

console.log("done");

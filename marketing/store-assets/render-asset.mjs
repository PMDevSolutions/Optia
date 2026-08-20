#!/usr/bin/env node
// Render an HTML template to a PNG at an exact size via Playwright.
// Adapted from Bridleway's render-pin.mjs (HTML -> social image pipeline).
//
// Usage:
//   node marketing/store-assets/render-asset.mjs <html-path> <output-png> \
//     [--width 1280] [--height 800] [--param key=value ...]
//
// --param pairs are passed to the template as URL query parameters, so one
// template can render many variants (headline, subhead, shot=path-to-capture).
//
// Chrome Web Store sizes:
//   screenshots: 1280x800 (or 640x400)   promo tile: 440x280   marquee: 1400x560

import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
import fs from "fs";

// Playwright lives in app/'s dependencies; resolve it from there.
const require = createRequire(new URL("../../app/package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
const positional = [];
let width = 1280;
let height = 800;
const params = new URLSearchParams();

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--width") width = Number(args[++i]);
  else if (args[i] === "--height") height = Number(args[++i]);
  else if (args[i] === "--param") {
    const [key, ...rest] = args[++i].split("=");
    params.set(key, rest.join("="));
  } else positional.push(args[i]);
}

const [htmlArg, outArg] = positional;
if (!htmlArg || !outArg) {
  console.error(
    "Usage: node render-asset.mjs <html-path> <output-png> [--width N] [--height N] [--param k=v ...]",
  );
  process.exit(1);
}

const absHtml = path.resolve(htmlArg);
const absOut = path.resolve(outArg);
if (!fs.existsSync(absHtml)) {
  console.error(`HTML file not found: ${absHtml}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(absOut), { recursive: true });

const query = params.toString();
const fileUrl = pathToFileURL(absHtml).toString() + (query ? `?${query}` : "");

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1, // CWS wants exact pixel dimensions, not 2x
});
const page = await ctx.newPage();
await page.goto(fileUrl, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: absOut, fullPage: false, type: "png" });
await browser.close();

const size = fs.statSync(absOut).size;
console.log(`Rendered ${absOut} (${width}x${height}, ${(size / 1024).toFixed(1)} KB)`);

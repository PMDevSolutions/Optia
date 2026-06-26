/**
 * Generate the Optia extension icons (PNG) from the SVG master.
 *
 * Usage:  pnpm icons
 * Source: icons/icon.svg  ->  icons/icon-{16,32,48,128}.png
 *
 * Requires `sharp` (devDependency). Re-run whenever icon.svg changes.
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, "..", "icons");
const svg = readFileSync(join(iconsDir, "icon.svg"));
const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const out = join(iconsDir, `icon-${size}.png`);
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`✓ icon-${size}.png`);
}

console.log("Done — Optia icons regenerated.");

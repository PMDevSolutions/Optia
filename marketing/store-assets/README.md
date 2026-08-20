# Chrome Web Store Assets

HTML-template → PNG pipeline for the store listing's visual assets (pattern borrowed from Bridleway's social-image renderer). Templates render at exact CWS pixel sizes; content is injected via `--param` query parameters so one template produces every variant.

## Specs

| Asset | Size | Notes |
|---|---|---|
| Screenshots (1–5) | **1280×800** (or 640×400) | No transparency. At least one is required. |
| Small promo tile | **440×280** | Shown in search and category pages. |
| Marquee promo tile | 1400×560 | Optional, for featured placements. |

## Usage

Requires `pnpm install` in `app/` (Playwright is resolved from there) and `pnpm --dir app playwright:install` once.

```bash
node marketing/store-assets/render-asset.mjs marketing/store-assets/templates/promo-tile.html marketing/store-assets/out/promo-tile-440x280.png --width 440 --height 280

node marketing/store-assets/render-asset.mjs marketing/store-assets/templates/screenshot-frame.html marketing/store-assets/out/screenshot-1.png --width 1280 --height 800 --param "headline=Instant SEO score for any page" --param "subhead=Enter your keyword, get a 0-100 score with priority-labeled fixes." --param shot=captures/score-view.png
```

## Workflow

1. **Capture the product**: load the built extension (`pnpm --dir app build`, then load `app/dist` unpacked), open the side panel on a realistic page, and screenshot the panel states — setup, score view, subscores, AI recommendation, options/license card. Save captures into `marketing/store-assets/templates/captures/` (the `shot` param resolves relative to the template file).
2. **Frame them**: render each capture through `screenshot-frame.html` with a benefit-led headline. Suggested set:
   - Score view — "Instant SEO score for any page"
   - AI recommendation — "AI titles, metas, and alt text in one click"
   - Subscores — "Priority-labeled checks across 8 categories"
   - Options/Pro — "Free 25 AI recs a month. Pro for 1,000 — or bring your own key"
3. **Tile**: render `promo-tile.html` as-is or with a custom `tagline`/`score`.
4. Keep final PNGs out of git if large; upload them to the CWS Developer Dashboard and check them off in `docs/chrome-web-store-listing.md`.

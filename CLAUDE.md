# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Optia** — a Manifest V3 Chrome extension for on-page SEO analysis with AI-powered recommendations (OpenAI, GPT-4o-mini, user supplies their own key). It scores any page, breaks the score down by category, and generates plain-language fixes.

> **The entire app lives in `app/`, NOT the repo root.** Always `cd app` before running dev/build/test/lint. The repo root holds only this file, `.claude/`, `docs/`, `README.md`, and store assets.

Stack: React 19 · TypeScript (strict) · Vite 6 + `@crxjs/vite-plugin` · Tailwind CSS 3 · Zustand 5 · OpenAI SDK · Vitest 3 + React Testing Library + jsdom.

## Commands (run from `app/`)

```bash
cd app
pnpm dev          # WEB PREVIEW at http://localhost:5173/dev.html (vite.config.dev.ts)
                  #   - runs the side panel as a normal web app, no extension reload
                  #   - proxies /api/fetch-page and /api/openai for fast iteration
pnpm dev:ext      # REAL extension watch build (crxjs); load app/dist as unpacked, HMR
pnpm build        # tsc && vite build  ->  app/dist  (load unpacked / package for store)
pnpm test         # vitest run (309 tests)
pnpm test:watch   # vitest watch
pnpm lint         # eslint .   (flat config app/eslint.config.js — NO Prettier in this repo)
pnpm lint:fix     # eslint . --fix
pnpm icons        # regenerate icons/icon-{16,32,48,128}.png from icons/icon.svg (sharp)
```

There is **no Prettier**, no design tokens/lockfiles, no Storybook, no Playwright, no Next.js, and no Figma pipeline in this repo. Ignore any tooling that assumes them.

## Architecture (`app/src/`)

| Area | Files | Notes |
|------|-------|-------|
| Background | `background/service-worker.ts` | MV3 service worker + message router; side-panel lifecycle; injects the page extractor via `chrome.scripting` |
| Content | `content/{index,analyzer,highlighter}.ts` | injected on `<all_urls>`; `analyzer.ts` extracts page SEO data, `highlighter.ts` outlines issues |
| Side panel | `sidepanel/App.tsx` + `pages/{Loading,Score,Setup,Subscores}.tsx` | main React UI; all SW calls go through `sendToServiceWorker<T>()` |
| Options | `options/{Options,main}.tsx` | API key + default language |
| Lib | `lib/{openai,storage,store,scoring,seo-analyzer,schema-recommendations,fetch-page,extract-page-data-inline,docs-links,languages,theme}.ts` | `storage.ts` = chrome.storage wrapper, `store.ts` = zustand, `theme.ts` = light/dark |
| Types | `types/seo.ts` | `PageSEOData`, `SEOCheck`, `SEOAnalysis`, `CheckCategory` |

**Two page extractors must stay in sync:** `content/analyzer.ts` (typed) and `lib/extract-page-data-inline.ts` (import-free, injected via `executeScript`). They must return the same `PageSEOData`.

## SEO scoring model (`lib/scoring.ts`, `lib/seo-analyzer.ts`)

- `runSEOChecks(pageData, opts)` → ~25 checks across 5 categories → `calculateAnalysis()` → `SEOAnalysis`.
- `categoryWeights`: meta `.25`, content `.25`, links `.15`, images `.15`, technical `.20` — **must sum to 1.0**.
- Per check: pass = 1, warning = 0.5, fail = 0; an empty category scores 100.
- Score → label ladder lives in `scoring.ts` (90/80/60/40); the gauge **color** ladder is separate in `ScoreGauge.tsx` (70/40).
- Check `id` is an untyped string duplicated across `seo-analyzer.ts`, `openai.ts`'s switch, and `SubscoresPage.tsx`; `docs-links.ts` is keyed by check **title**. Adding a check touches ~8 files — use `/add-seo-check`.

## Testing

Vitest + RTL + jsdom. `chrome.*` is hand-mocked in `src/test/setup.ts` (storage + runtime only). The service worker test builds its own listener-capturing mock. See the **testing-chrome-extension** skill before writing tests (load-order rule, openai mocking, the App.tsx coverage gap).

## Release (Chrome Web Store)

Run releases from `app/` **only** — `app/.versionrc.json` bumps both `package.json` and `manifest.json` and tags `app-v*`. Use `/release-extension`. (The repo root has no release config by design; never run `standard-version` from root.)

## Skills & commands

- **chrome-extension-dev** skill — MV3 message catalog, storage schema, SW lifecycle, side-panel lifecycle, the two-extractor rule, dev-mode detection.
- **testing-chrome-extension** skill — real Vitest/chrome-mock/openai-mock patterns.
- `/add-seo-check` — ordered cross-file workflow to add an SEO check.
- `/release-extension` — the one correct path to cut a store release.
- `/lint`, `/test` — quality commands.

Curated agents live in `.claude/agents/` (engineering, QA, accessibility, app-store, marketing, support). MCP: `chrome-devtools` (drive/screenshot the UI, Lighthouse).

## Conventions

- TypeScript strict, no `any`; functional components; Tailwind utility-first with the design tokens in `tailwind.config.ts` + `src/styles/globals.css` (CSS-variable themes, light default + dark).
- 2-space indent; ESLint (`app/eslint.config.js`) is the source of truth for style.
- Never log or commit the user's OpenAI API key; the SDK runs in-browser (`dangerouslyAllowBrowser: true`) by design — the key is the user's and is sent only to OpenAI.

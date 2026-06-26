---
name: chrome-extension-dev
description: Orchestrating guide for working on the Optia MV3 Chrome extension — service worker, content script, side panel, message passing, chrome.storage, and SW lifecycle. Use for any task touching chrome extension, manifest, service worker, content script, side panel, chrome.storage, message passing, or MV3 wiring.
---

# Optia MV3 Chrome Extension — Developer Skill

Optia is a Manifest V3 extension. All source lives in `app/src/`. Three runtime surfaces talk over `chrome.runtime` / `chrome.tabs` messages:

- **Service worker (SW)** — `app/src/background/service-worker.ts` (MV3 background, `"type": "module"`, message router)
- **Content script** — `app/src/content/index.ts` (injected into every page, `<all_urls>`)
- **Side panel** — `app/src/sidepanel/App.tsx` (React UI; all SW calls go through `sendToServiceWorker<T>()`)

`app/manifest.json` declares `permissions: ["tabs", "sidePanel", "storage", "scripting"]`, `host_permissions: ["<all_urls>"]`, `minimum_chrome_version: 116`.

---

## 1. Message catalog

Every `chrome.runtime` / `chrome.tabs` message string literal in the codebase. "Dormant" = handler exists but no in-tree sender currently uses it (kept for debug/fallback/future).

| `message.type` | Direction | Payload | Response | Handler |
|---|---|---|---|---|
| `EXTRACT_PAGE_DATA` | sidepanel → SW | `{ tabId }` | `{ data: PageSEOData }` or `{ error }` | `service-worker.ts:148` (injects `extractPageDataInline` via `chrome.scripting.executeScript`) |
| `PANEL_OPENED` | sidepanel → SW | `{ tabId }` | `{ ok: true }` | `service-worker.ts:105` (calls `addPanelTab`) |
| `HIGHLIGHT_ISSUES` | sidepanel → content | none | `{ ok: true }` | `content/index.ts:11` (calls `highlightIssues()`) |
| `PING` | (debug) → SW | none | `{ pong: true, timestamp }` | `service-worker.ts:98` — dormant |
| `GET_ACTIVE_TAB` | → SW | none | `{ tab }` | `service-worker.ts:116` — dormant |
| `EXECUTE_CONTENT_SCRIPT` | → SW | none | `{ results }` or `{ error }` | `service-worker.ts:123` — dormant |
| `SEND_TO_CONTENT` | → SW | `{ payload }` | forwarded content response or `{ error }` | `service-worker.ts:184` (relays `payload` to active tab via `chrome.tabs.sendMessage`) — dormant |
| `EXTRACT_SEO_DATA` | → content | none | `{ data }` (from `extractPageSEOData()`) | `content/index.ts:5` — dormant |
| `CLEAR_HIGHLIGHTS` | → content | none | `{ ok: true }` | `content/index.ts:17` — dormant |

Actual senders in tree:
- `App.tsx:184` — `EXTRACT_PAGE_DATA` via `sendToServiceWorker<PageSEOData>(...)`.
- `App.tsx:215` — `PANEL_OPENED` via raw `chrome.runtime.sendMessage` (fire-and-forget, no response awaited).
- `App.tsx:454` — `HIGHLIGHT_ISSUES` via `chrome.tabs.sendMessage` direct to content (errors swallowed with `void chrome.runtime.lastError`).

---

## 2. Rules for message handlers

- **Async handlers MUST `return true`** to keep the message port open until `sendResponse` runs; otherwise the port closes and the caller gets an empty/`undefined` response. Every handler in `service-worker.ts` and `content/index.ts` ends with `return true`.
- **Call `sendResponse` exactly once** on every code path (success AND error). See the `EXTRACT_PAGE_DATA` handler: the async IIFE has a `try/catch` that responds, plus a `.catch()` that guards the already-responded case (`service-worker.ts:172-180`).
- **The side panel goes through `sendToServiceWorker<T>()`** (`App.tsx:109`) for any request/response SW call — never raw `chrome.runtime.sendMessage`. The helper wraps: 15s `timeout`, `chrome.runtime.lastError` check, synchronous-throw catch, and retry (default 2) on `"Could not establish connection"` to ride out SW cold-starts. The only raw exceptions are the two fire-and-forget sends noted above (`PANEL_OPENED`, `HIGHLIGHT_ISSUES`), which intentionally await no response.

---

## 3. Service-worker lifecycle

The MV3 SW is **killed when idle and respawned on the next event**. Module-scope variables are wiped on every wake. Rule: **never keep durable state only in a module-scope variable** — rehydrate from storage on startup.

Real pattern — `panelTabs`:
- `const panelTabs = new Set<number>()` declared at module scope (`service-worker.ts:27`), key `PANEL_TABS_KEY = "panel_tabs"`.
- On every SW startup it is rehydrated from `chrome.storage.session` (`service-worker.ts:31-39`).
- Mutations always go through `addPanelTab` / `removePanelTab`, which call `persistPanelTabs()` to write the Set back to session storage (`service-worker.ts:41-57`). Never `panelTabs.add()` directly without persisting.

---

## 4. Storage schema

Two stores. Pick by durability.

**`chrome.storage.local` (durable, survives browser restart)** — accessed via `app/src/lib/storage.ts` helpers (`getStorageItem` / `setStorageItem` / `removeStorageItem`, which fall back to `localStorage` in web/dev mode):

| Key | Written by |
|---|---|
| `openai_api_key` | `store.ts` `setApiKey` / `loadApiKey` |
| `default_language` | read in `store.ts` `loadApiKey` (set in options) |
| `url_keywords` | `storage.ts` `saveKeywordForUrl` (host → keyword map) |
| `site_options` | `storage.ts` `saveAdvancedOptions` (host → `{pageType, secondaryKeywords, language}`) |
| `onboarding_dismissed` | Onboarding component |
| `theme` | options / theme toggle |

**`chrome.storage.session` (ephemeral, cleared when browser closes)** — written directly, NOT via the `storage.ts` `local` helpers:

| Key | Written by |
|---|---|
| `tab_analysis_<tabId>` | `storage.ts` `saveTabAnalysis` / `getTabAnalysis` / `clearTabAnalysis` (per-tab `TabAnalysisState`) |
| `panel_tabs` | `service-worker.ts` `persistPanelTabs` (rehydrated SW state) |

Cleanup: `tab_analysis_<tabId>` is removed on tab close (`service-worker.ts:87`) and on same-tab navigation (`App.tsx:288`).

Rule: durable user data → `local` via `storage.ts`; ephemeral per-tab/per-session state → `session`.

---

## 5. Side-panel lifecycle

- On install/load the SW **globally disables** the panel (`chrome.sidePanel.setOptions({ enabled: false })`, `service-worker.ts:10`) and disables auto-open (`setPanelBehavior({ openPanelOnActionClick: false })`, `service-worker.ts:6`).
- Clicking the toolbar action **enables + opens the panel for that one tab** (`chrome.action.onClicked`, `service-worker.ts:13-23`) — synchronous, because it runs inside a user gesture.
- The React app sends **`PANEL_OPENED` with its `tabId` on mount** (`App.tsx:211-218`) so the SW records the tab in `panelTabs`.
- **Empty-set guard:** `chrome.tabs.onActivated` returns early when `panelTabs.size === 0` (`service-worker.ts:66`). This avoids a chicken-and-egg bug where the first click after install/reload would be blocked before any panel has registered. Once non-empty, switching tabs enables the panel only for tabs in `panelTabs` and disables it for all others.

---

## 6. The two extractors (keep in sync)

There are **two copies** of the page-extraction logic that MUST change together and return the identical `PageSEOData` shape (`app/src/types/seo.ts`):

1. `app/src/content/analyzer.ts` → `extractPageSEOData()` — the canonical, typed version (imports `PageSEOData`, `ImageData`), used by the content script's `EXTRACT_SEO_DATA` handler.
2. `app/src/lib/extract-page-data-inline.ts` → `extractPageDataInline()` — the injected version used by `chrome.scripting.executeScript` in both the SW (`EXTRACT_PAGE_DATA`, `service-worker.ts:157`) and the side panel fallback (`directExecuteScript`, `App.tsx:171`).

The inline one **must stay import-free / self-contained** — it is serialized and run in the page context, so it cannot reference imports, closures, or module variables (see its file-top warning). When you edit one extractor, mirror the change in the other and confirm both return the same fields.

---

## 7. Dev-mode detection

```ts
const isDevMode = typeof chrome === "undefined" || chrome.tabs === undefined;
```
(`App.tsx:27`.) This exists because Optia runs in two modes: the real extension, and a **web preview at `http://localhost:5173/dev.html`** (`vite.config.dev.ts`, with `/api/fetch-page` + `/api/openai` proxies). In dev mode there is no `chrome.tabs`, so the app fetches the target URL over HTTP (`fetchAndAnalyzePage`, `App.tsx:348`) instead of injecting a script, and skips all tab/panel/highlight wiring (`App.tsx:212, 247, 267, 447`). `storage.ts` mirrors this with `isChromeExtension` and falls back to `localStorage`. Always guard extension-only APIs behind `isDevMode` / `isChromeExtension`.

---

## 8. Checklist: wiring a new cross-surface message

1. **Add the handler** in the receiving surface (`service-worker.ts` for SW; `content/index.ts` for content). Match on `message.type`, call `sendResponse` on every path, and `return true`.
2. **Add the sender.** From the side panel use `sendToServiceWorker<T>({ type: "YOUR_TYPE", ... })` for request/response; only use raw `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` for fire-and-forget. Add the literal to this skill's catalog.
3. **Type the payload** against `app/src/types/seo.ts` shapes where relevant (e.g. `PageSEOData`). If the message moves page data, decide whether it needs the inline extractor (executeScript) or the content-script extractor — and keep both in sync (§6).
4. **Update the test chrome mock.** Global mock lives in `app/src/test/setup.ts` (`chrome.storage.local/session`, `chrome.runtime`). The SW test builds its own listener-capturing mock and invokes `onMessageCallback(message, sender, sendResponse)` directly — `app/src/background/service-worker.test.ts:21-60`. Add any new `chrome.*` API you call to the relevant mock or the test will throw.
5. **Verify:** `cd app && pnpm test && pnpm lint && pnpm build`.

---
name: testing-chrome-extension
description: Real Vitest patterns for this MV3 extension — how to mock chrome.*, test the service worker without import-order hangs, mock the OpenAI SDK, and drive RTL/Zustand. Use when you write tests, fix tests, mock chrome, test the service worker, hit a hanging/timing-out test, or touch vitest.
---

# Testing the Optia Chrome Extension

Stack: Vitest 3 (`globals: true`, jsdom), React Testing Library, `@testing-library/user-event`. Config: `app/vitest.config.ts` (setup `./src/test/setup.ts`, include `src/**/*.test.{ts,tsx}`, `@` → `src`). Run from `app/`: `pnpm test`.

Because `globals: true`, `vi` / `describe` / `it` / `expect` / `beforeEach` are global — but the existing files import them explicitly too; either is fine.

---

## 1. Chrome mocking

A single hand-rolled `chrome` mock lives in `app/src/test/setup.ts` and is installed for every test:

- `createStorageMock(store)` returns `{ get, set, remove }` backed by a plain in-memory object. `get` handles both `string` and `string[]` keys; `set` does `Object.assign`; `remove` deletes keys. All return resolved promises.
- `globalThis.chrome` is defined with `Object.defineProperty(..., { writable: true })` exposing only `storage.local`, `storage.session`, and `runtime.{sendMessage, onMessage.addListener}`.
- A global `beforeEach` empties both stores and calls `vi.clearAllMocks()`.

Because `storage.local` AND `storage.session` are both present, `storage.ts`'s import-time flags `isChromeExtension` and `isSessionAvailable` (see §2) both evaluate `true` in tests — that's why `storage.test.ts` round-trips work against the in-memory store with no extra setup.

### The gap (and the fix)

`sidepanel/App.tsx` is the biggest `chrome.*` consumer and is **untested**, because the global mock has no `tabs`, `scripting`, `sidePanel`, or `runtime.lastError`. Tests that need those currently rebuild a bespoke `chromeMock` inline (`service-worker.test.ts` lines 21–82; `storage.test.ts` lines 176–209), which drifts.

Recommended: extract a `createChromeMock(overrides)` factory into `app/src/test/chrome-mock.ts` as the single source of truth — full `storage.local`/`session`, `runtime` (incl. `lastError`), `tabs`, `scripting`, `sidePanel`, `action` — and let `setup.ts` and each test spread overrides on top. This is the prerequisite for closing the App.tsx hole (§5).

---

## 2. Load-order rule (the #1 cause of wrong/hanging SW tests)

Some modules **cache `chrome` detection or register listeners at import time**, so they snapshot whatever `globalThis.chrome` is when first imported:

- `storage.ts` (lines 3–4, 79–82): `isChromeExtension` and `isSessionAvailable` are top-level `const`s evaluated once on import.
- `background/service-worker.ts`: calls `setPanelBehavior`/`setOptions` and registers `action.onClicked`, `tabs.onActivated`, `tabs.onRemoved`, `runtime.onMessage` listeners as **side effects at module top level**.

Rule: when a test depends on a *specific* chrome shape for one of these modules, you MUST

1. assign `globalThis.chrome = <your mock>` **before** importing the module,
2. call `vi.resetModules()` in `beforeEach` so the import re-runs against the fresh mock, and
3. import the module **dynamically** with `await import(...)` inside the test — never a static top-of-file `import`.

`service-worker.test.ts` is the template:

```ts
let onMessageCallback: (m, sender, sendResponse) => boolean | void;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  const chromeMock = { /* action, sidePanel, tabs, runtime, scripting, storage */
    runtime: { onMessage: { addListener: vi.fn((cb) => { onMessageCallback = cb; }) }, lastError: null },
    tabs:    { onActivated: { addListener: vi.fn((cb) => { onActivatedCallback = cb; }) }, /* ... */ },
  };
  (globalThis as any).chrome = chromeMock;     // setup.ts made chrome writable
});

async function loadServiceWorker() { await import("./service-worker"); }
```

The pattern: stub `addListener` to **capture the callback** into an outer-scope `let`, `await loadServiceWorker()` inside the test, then invoke the captured callback directly (`onActivatedCallback({ tabId: 2 })`, `onMessageCallback({ type: "PANEL_OPENED", tabId: 1 }, {}, sendResponse)`) and assert on the mocks (e.g. `setOptionsMock` was called with `{ tabId: 2, enabled: false }`). For async message handlers, wait with `await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }))` (lines 219–221) — do not assert synchronously after a `tabId`-bearing `PANEL_OPENED`.

Counter-example to learn from: `storage.test.ts`'s "tab analysis with mocked chrome.storage.session" block reassigns `globalThis.chrome` in `beforeEach` but uses the **statically imported** `storage.ts`, so the new mock is never seen (its own comment, lines 253–255, admits this). Those tests therefore only assert static facts (key format `tab_analysis_{id}`, object shape). If you want them to exercise the real session path, switch to `vi.resetModules()` + `await import("./storage")`.

---

## 3. OpenAI mocking

`openai.test.ts` hoists one mock fn and replaces the SDK before importing `./openai`:

```ts
const mockCreate = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));
import { generateRecommendation, /* ... */ } from "./openai";
```

`vi.mock` is hoisted above the import, so the static import is fine here (unlike §2 — no chrome snapshot involved). Helpers: `mockSuccessResponse(content)` → `mockResolvedValueOnce({ choices: [{ message: { content } }] })`; `mockErrorResponse(status, msg)` → reject with an `Error` carrying `.status`. `beforeEach` does `vi.clearAllMocks(); mockCreate.mockReset()`.

Retry/backoff — pick ONE strategy, never mix:

- **Fake timers** for the happy retry path: `vi.useFakeTimers()`, kick off the call, `await vi.runAllTimersAsync()`, `await promise`, assert `toHaveBeenCalledTimes(2)`, then `vi.useRealTimers()` (lines 243–267).
- **Real timers + long timeout** for the exhaustion path: `it("throws after max retries exceeded", { timeout: 15000 }, ...)`, `mockCreate.mockRejectedValue(error)`, expect 3 total calls (initial + `maxRetries = 2`) (lines 269–281).

`openai.ts` backoff is `await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)))` (line 44) with `maxRetries = 2` — actual sleeps are 1s then 2s before the final throw (the in-file test comment's "1s, 2s, 4s" overstates it; the 4s wait never happens because it throws when `retries === maxRetries`). Auth/billing errors (`401`/`403`) throw immediately with **no** retry — assert `toHaveBeenCalledOnce()`.

To assert prompt contents, reach into `mockCreate.mock.calls[0][0]` and find the message by role:
```ts
const userMsg = callArgs.messages.find((m: { role: string }) => m.role === "user");
expect(userMsg.content).toContain("landing page");
```

---

## 4. React Testing Library + Zustand

`Options.test.tsx` is the working RTL example. Key moves:

- Drive `chrome.storage.local.get` per test via `mockImplementation`, casting the global mock: `(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.resolve({ openai_api_key: "sk-...", default_language: "fr" }))`. A `beforeEach` resets it to `Promise.resolve({})`.
- Assert async load with `await waitFor(() => expect(screen.getByLabelText(/openai api key/i)).toHaveValue("sk-test-key-123"))`.
- Interact via `const user = userEvent.setup()` then `user.clear` / `user.type` / `user.selectOptions` / `user.click`; assert persistence with `expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({...}))`.
- Query by accessible role/label (`getByRole("heading"|"button")`, `getByLabelText`) — this doubles as the a11y check.

**`navigator.clipboard`**: jsdom has none. Components that copy (Score/Subscores recommendations) need a stub before render:
```ts
Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
```

**Zustand store** (`lib/store.ts`): reset shared state in `beforeEach` so tests don't leak — `useStore.setState({ /* known baseline */ }, /* replace? */)` (or `useStore.setState(useStore.getInitialState())` if exposed). Do this before `render(...)` for any component reading the store.

---

## 5. Known coverage holes — target these next

- **`sidepanel/App.tsx`** — the largest untested surface; blocked on the `tabs`/`scripting`/`sidePanel`/`lastError` mock gap. Land `createChromeMock` (§1) first, then test mount/loading/score flows.
- **`content/index.ts`, `content/analyzer.ts`, `content/highlighter.ts`** — no tests. `analyzer.ts` (DOM scraping) is pure-ish and easy to cover under jsdom by building a document fixture; `highlighter.ts` needs DOM-injection assertions; `index.ts` is the message bridge (apply the §2 listener-capture pattern).

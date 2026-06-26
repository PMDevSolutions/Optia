# /add-seo-check

Add a new SEO check to Optia, keeping the ~8 files that must stay in sync consistent. A check is a `checks.push({...})` object inside `runSEOChecks` in `app/src/lib/seo-analyzer.ts`. Most checks read existing fields on `PageSEOData`; only some need new raw extracted data and/or AI-generated fixes. Follow the steps **in order** and run the tests at the end.

## Usage

```
/add-seo-check
```

Then describe the check (what it measures, pass/warning/fail rule, category). Work through every step below that applies. Skip a step only when its leading "If ..." condition is false.

## Files involved

| File | What you touch |
|------|----------------|
| `app/src/lib/seo-analyzer.ts` | `runSEOChecks` — the check object itself |
| `app/src/types/seo.ts` | `PageSEOData` (new raw field), `SEOCheck`/`CheckCategory` (reference only) |
| `app/src/content/analyzer.ts` | `extractPageSEOData()` — typed twin extractor |
| `app/src/lib/extract-page-data-inline.ts` | `extractPageDataInline()` — import-free twin extractor |
| `app/src/lib/docs-links.ts` | `CHECK_URLS` map (keyed by check **title**) |
| `app/src/lib/openai.ts` | `generateRecommendation` `checkId` switch (copyable/AI checks) |
| `app/src/sidepanel/pages/SubscoresPage.tsx` | the two ternary chains: `context` and `label` |
| `app/src/lib/seo-analyzer.test.ts` | pass/warning/fail tests + `makePageData` fixture |
| `app/src/lib/scoring.ts` + `scoring.test.ts` | only for a brand-new category |

---

## Steps

### 0. Pick the category and decide if new raw data is needed

Choose one `CheckCategory` from `app/src/types/seo.ts:37`: `"meta" | "content" | "links" | "images" | "technical"`. Put the check object in the matching `// --- META ---` / `CONTENT` / `LINKS` / `IMAGES` / `TECHNICAL` section of `runSEOChecks`.

Decide: can the rule be computed from an existing `PageSEOData` field? If yes, skip step 1. If you need a new raw value scraped from the page (e.g. a new meta tag, a new resource list), do step 1.

Also decide if the check is **AI-fixable / copyable** (the user can copy a generated fix). If yes, you will do steps 5.

### 1. (If new raw data) add the field in FOUR places — keep both extractors identical

The two extractors are twins and **must** produce the same shape. `extract-page-data-inline.ts` is serialized and injected via `chrome.scripting.executeScript`, so it **cannot use any imports, closures, or external variables** — keep it fully self-contained (see its header comment).

1. `app/src/types/seo.ts` → add the field to the `PageSEOData` interface (lines 1-26).
2. `app/src/content/analyzer.ts` → return the field from `extractPageSEOData()` (typed version).
3. `app/src/lib/extract-page-data-inline.ts` → return the field from `extractPageDataInline()` (import-free version, identical logic).
4. `app/src/lib/seo-analyzer.test.ts` → add the field to the `makePageData()` fixture (lines 4-34) so the default object stays a valid `PageSEOData`.

### 2. Add the check object to `runSEOChecks`

In `app/src/lib/seo-analyzer.ts`, `checks.push({...})` inside the correct category section. Rules:

- `id`: **kebab-case**, unique across all checks (e.g. `"favicon-present"`).
- `title`: **sentence case**, human-readable. This exact string is the docs-links key (step 3) and the `learnMoreUrl` lookup (`getLearnMoreUrl(check.title)` at lines 456-459). **Keep it static** — do not interpolate variables (see step 3 warning).
- `status`: return `"pass" | "warning" | "fail"`. Use the keyword helpers `containsAnyKeyword(text, keyword, secondaryKws)` / `containsKeywordWB` (lines 10-18) if the rule is keyword-based.
- `priority`: `"high" | "medium" | "low"`.
- `category`: must match the section you chose in step 0.
- `details`: short human string describing the result.
- Homepage special case: if your rule should relax for homepages, branch on `pageType === "homepage"` like `keyword-url` (lines 111-126) and `word-count`'s `minWords` (line 200).

### 3. Add a `CHECK_URLS` entry in `docs-links.ts`

In `app/src/lib/docs-links.ts`, add an entry to `CHECK_URLS` keyed by the **EXACT** `title` string from step 2, pointing at the relevant GitBook page under `BASE_URL`. If you skip this, `getLearnMoreUrl` falls back to the generic guide URL.

> ⚠️ **Dynamic titles never match.** `CHECK_URLS` is keyed by static strings, but some titles are interpolated — e.g. `word-count`'s title is `` `Page has sufficient content (${minWords}+ words)` ``, which is why it is absent from `CHECK_URLS` and always hits the fallback. If your title must be dynamic, either keep a static title, or refactor `getLearnMoreUrl` / `CHECK_URLS` to key by check **`id`** instead (and update the `.map` at `seo-analyzer.ts:456-459` and all existing keys if you do).

### 4. Add tests to `seo-analyzer.test.ts`

In `app/src/lib/seo-analyzer.test.ts`, add cases to the matching `describe` block (`Meta checks` / `Content checks` / `Links checks` / `Images checks` / `Technical checks`). Cover **every** status your rule can produce — at minimum a pass and a fail, plus a warning if applicable. Use the existing pattern:

```ts
it("my-new-check: passes when <condition>", () => {
  const checks = runSEOChecks(makePageData({ someField: validValue }), defaultOptions);
  expect(findCheck(checks, "my-new-check").status).toBe("pass");
});
```

`findCheck` (lines 36-40) throws if the id is missing, so a typo in `id` fails loudly.

### 5. (If copyable / AI) wire the AI fix path

Set `copyable: true` on the check object (step 2), then:

1. `app/src/lib/openai.ts` → add `case "my-new-check":` to the `switch (checkId)` in `generateRecommendation` (line 95). Either give it a tailored `copyableSystem` prompt (like `title-keyword`, lines 96-104) or, if generic advice is fine, add its id to the shared advisory `case` group (lines 150-162). Without a case it falls to `default` (advisory text).
2. `app/src/sidepanel/pages/SubscoresPage.tsx` → wire **both** ternary chains in `renderCheckRecommendation`:
   - the `context` chain (lines 142-153): map `check.id === "my-new-check"` to the right source field on `analysis.pageData` (falls back to `check.details ?? ""`).
   - the `label` chain (lines 155-166): map `check.id === "my-new-check"` to a UI label like `"AI Suggested X"` (falls back to `"AI Recommendation"`).

> **Exceptions — do NOT use the switch for these two.** `h2-keyword` and `images-alt` are `copyable` but are intercepted earlier in `SubscoresPage` (lines 84 and 113) and routed to `generateH2Suggestion` / `generateAltText` (their own functions in `openai.ts`), **not** `generateRecommendation`. `schema-markup` is also intercepted (line 130) and renders `SchemaDisplay`. If your check needs a bespoke UI like these, add a similar early branch instead of the generic `EditableRecommendation` path.

### 6. (If a brand-new category) update scoring — weights MUST re-sum to 1.0

Only if you introduced a `CheckCategory` value that did not exist before:

1. `app/src/types/seo.ts:37` → add the value to the `CheckCategory` union.
2. `app/src/lib/seo-analyzer.ts` → add the key to the `groups` object in `groupChecksByCategory` (lines 465-471).
3. `app/src/lib/scoring.ts` → add the key to `categoryLabels` (lines 10-16) and `categoryWeights` (lines 18-24). **The weights must still sum to exactly `1.0`** (current: `0.25 + 0.25 + 0.15 + 0.15 + 0.20 = 1.0`) — rebalance the existing weights accordingly.
4. `app/src/lib/scoring.test.ts` → update fixtures/expectations for the new category.

### 7. Run the test suite

```bash
cd app && pnpm test
```

All tests (including the `learnMoreUrl` "every check has a learnMoreUrl" and `groupChecksByCategory` totals tests at the bottom of `seo-analyzer.test.ts`) must pass. Then run `pnpm lint` and `pnpm build` if you changed types.

---

## Copy-paste check-object template

```ts
checks.push({
  id: "my-new-check",                 // kebab-case, unique across all checks
  title: "Page does the thing",       // EXACT, STATIC string — also the docs-links.ts key
  description: "Why this matters for SEO.",
  status: data.someField ? "pass" : "fail", // "pass" | "warning" | "fail"
  priority: "medium",                 // "high" | "medium" | "low"
  category: "technical",              // "meta" | "content" | "links" | "images" | "technical"
  details: data.someField ? `Found: ${data.someField}` : "Not found.",
  // copyable: true,                  // only for AI-fixable checks (then do step 5)
});
```

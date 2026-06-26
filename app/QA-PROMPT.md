# Optia — Visual QA, Functional Testing & Code Review

## Your Role

You are a senior QA engineer and code reviewer. Your job is to:

1. **Visually compare** the running dev app against the Figma design
2. **Functionally test** every feature and interaction in the app
3. **Code review** the implementation for correctness, consistency, and bugs

Produce a single structured report with all findings at the end.

---

## Access Points

### Dev App
- **URL:** `http://localhost:5173/dev.html`
- **Framework:** React 19 + Tailwind CSS + Vite, rendered inside a 450px-wide frame on a dark (#111) background
- **Mode:** Dev mode (not Chrome extension) — a URL input field is visible at the top for the page to analyze
- **Start the dev server** (if not already running): `cd app && pnpm dev`

### Figma Design
- **URL:** https://www.figma.com/design/XHeNqqkfgEzFShJCia5BsL/AI-SEO-Copilot-design?node-id=277-298&m=dev
- **File key:** `XHeNqqkfgEzFShJCia5BsL`
- **Node ID:** `277:298`
- Use `get_design_context` and `get_screenshot` to capture the Figma frames for comparison.

### Test Page (for analysis)
- Use any live public URL with known SEO characteristics, e.g. `https://example.com` or `https://en.wikipedia.org/wiki/Search_engine_optimization`
- The dev app fetches pages server-side via a Vite proxy at `/api/fetch-page?url=...`

### Codebase
- **Root:** `app/` (all paths below are relative to the repo root)
- **Source:** `app/src/`

---

## Design System Reference

The app uses a strict dark-mode design system. Match these tokens against both Figma and the rendered output:

| Token | Value | Usage |
|-------|-------|-------|
| `bg-900` | `#1A1A1A` | Page background |
| `bg-700` | `#323232` | Card backgrounds, advanced panel |
| `bg-500` | `#444444` | Input backgrounds, borders, nested cards |
| `bg-300` | `#787878` | Placeholder text |
| `text-primary` | `#FFFFFF` | Headings, body text |
| `text-secondary` | `#C7C7C7` | Labels, descriptions, metadata |
| `red` | `#FF4343` | Fail badges, error states |
| `green` | `#A2FFB4` | Pass badges, success states, copied feedback |
| `yellow` | `#FFDD64` | Warning badges, medium priority |
| `accent-blue` | `#1A72F5` | Primary buttons, focus rings, icons |

**Typography:** h1=28px/500, h2=20px/600, body=18px, body-16=16px, body-12=12px, button=16px/500
**Radii:** card=12px, input=8px
**Width:** Body is `min-width: 400px`, dev frame is `450px`

---

## Part 1: Visual Comparison (Figma vs App)

### Instructions

1. Capture screenshots of the Figma design using the Figma MCP tools (`get_screenshot` with fileKey `XHeNqqkfgEzFShJCia5BsL` and nodeId `277:298`). Also retrieve child frames/nodes if the design has multiple screens.
2. Navigate to `http://localhost:5173/dev.html` in Chrome DevTools or Playwright.
3. Capture screenshots of each app screen (see screens list below).
4. Compare side-by-side. Flag any differences.

### Screens to Compare

#### Screen 1: Setup Page (initial state)
- Navigate to the dev app URL. This is the default view.
- **Expected elements:**
  - Blue circle icon with Settings gear + "Optia" heading
  - "Dev mode" subtitle
  - "Page URL to Analyze" input (dev mode only)
  - "OpenAI API Key (optional)" password input
  - "Target Keyword" input
  - "Advanced Analysis" toggle (off by default)
  - "Optimize my SEO" button (disabled, with arrow icon)
  - Footer with 4 links: Documentation, Feature requests, Report a bug, Contact us

#### Screen 2: Setup Page (advanced mode expanded)
- Toggle "Advanced Analysis" ON
- **Expected elements:**
  - Dark card (`bg-700`) containing:
    - "Page Type" dropdown with 16 options: Homepage, Category Page, Product Page, Product Software, Blog Post, Landing Page, Contact Page, About Page, Service Page, Portfolio Page, Testimonial Page, Location Page, Legal Page, Event Page, Press/News Page, Job/Career Page
    - "Language" dropdown with 9 options showing flag emojis: 🇺🇸 English, 🇫🇷 French, 🇩🇪 German, 🇪🇸 Spanish, 🇮🇹 Italian, 🇯🇵 Japanese, 🇵🇹 Portuguese, 🇳🇱 Dutch, 🇵🇱 Polish
    - "Secondary Keywords" textarea (3 rows)

#### Screen 3: Loading Page
- Enter a URL and keyword, click "Optimize my SEO"
- **Expected elements:**
  - Centered spinning Loader2 icon (blue)
  - "Analyzing your page" heading
  - "Extracting SEO data and running checks..." subtitle
  - Animated progress bar (blue, pulsing, 60% width)

#### Screen 4: Score Page
- Wait for analysis to complete
- **Expected elements:**
  - "New Analysis" back link with arrow
  - Animated circular ScoreGauge (180px, 10px stroke)
    - Green (#A2FFB4) if ≥80, yellow (#FFDD64) if ≥50, red (#FF4343) if <50
    - Score number centered with "/100" below
  - Score label ("Excellent", "Great", "Fair", "Needs Work", or "Poor")
  - Score description text
  - Pass count (green with CheckCircle) and fail count (red with XCircle)
  - **5 category cards** (not 4!) labeled:
    - "Meta Tags"
    - "Content Analysis"
    - "Links"
    - "Images"
    - "Technical SEO"
  - Each card shows: label, passed count (green), failed count (red), ChevronRight

#### Screen 5: Subscores Page (per-category detail)
- Click into each of the 5 category cards to verify
- **Expected elements:**
  - "Back to Overview" link
  - Category heading + pass/fail counts
  - Checks sorted by priority: high → medium → low
  - Each check in a `CheckItem` card:
    - Badge colored by status/priority (green=pass, red=high fail, yellow=medium/low/warning)
    - Badge text: "Passed", "High Priority", "Medium", or "Low Priority"
    - Title text, chevron to expand
    - Expanded: description, details (italic), optional Learn More link
  - **For failing copyable checks** (title-keyword, meta-description-keyword, keyword-url, h1-keyword, keyword-intro):
    - `EditableRecommendation` component with label, editable textarea, copy + regenerate buttons
  - **For h2-keyword check:**
    - `H2SelectionList` with "Generate All" button, per-H2 row with original text, textarea, copy + regenerate
  - **For images-alt check:**
    - `ImageAltTextList` with per-image thumbnail, filename, input, generate + copy buttons
  - **For schema-markup check:**
    - `SchemaDisplay` with required/optional sections, collapsible cards, JSON-LD code block, copy button, Google support badge, documentation link

### Visual Diff Checklist

For each screen, report on:
- [ ] Background colors match design tokens
- [ ] Typography (size, weight, color) matches spec
- [ ] Spacing and padding are consistent
- [ ] Border radii (12px cards, 8px inputs)
- [ ] Button styles (primary blue, disabled state)
- [ ] Badge colors match status/priority mapping
- [ ] Icons (Lucide) match expected glyphs and sizes
- [ ] Footer layout and alignment
- [ ] Responsive behavior within the 450px frame
- [ ] Any extra or missing elements vs Figma

---

## Part 2: Functional Testing

### Test Flow A — Basic Analysis (no API key)

1. Load `http://localhost:5173/dev.html`
2. Verify the onboarding overlay appears on first visit
   - Should show 3 feature highlights (18 SEO Checks, AI Recommendations, Schema Templates)
   - Click "Get Started" — overlay dismisses
   - Reload page — overlay should NOT appear again (persisted in localStorage)
3. Enter URL: `https://example.com`
4. Enter keyword: `example`
5. Leave API key blank
6. Click "Optimize my SEO"
7. **Verify loading state** appears briefly
8. **Verify score page** shows with:
   - A numeric score 0-100
   - Correct label for that score range
   - 5 category cards (meta, content, links, images, technical)
   - Pass/fail counts add up to total checks shown
9. Click into "Meta Tags" category
10. **Verify** checks are sorted by priority (high first)
11. **Verify** no AI recommendation boxes appear (no API key)
12. Click "Back to Overview"
13. Click into "Technical SEO" category
14. **Verify** schema-markup check exists
15. If schema check is failing, verify `SchemaDisplay` shows JSON-LD templates for the current page type (default: "blog-post")
16. Click "New Analysis" to return to setup

### Test Flow B — Advanced Mode

1. Toggle "Advanced Analysis" ON
2. Verify the advanced panel appears with page type, language, secondary keywords
3. Open page type dropdown — verify all 16 options are present
4. Select "Homepage"
5. Open language dropdown — verify all 9 languages with flag emojis
6. Select "🇫🇷 French"
7. Enter secondary keywords: `domain\nwebsite`
8. Enter URL: `https://en.wikipedia.org/wiki/Search_engine_optimization`
9. Enter keyword: `SEO`
10. Click "Optimize my SEO"
11. **Verify** content length check says "300+ words" (homepage threshold, not 600)
12. **Verify** keyword density check calculates correctly
13. **Verify** keyphrase-in-introduction check references first paragraph
14. **Verify** H2 keyword check shows H2SelectionList
15. **Verify** internal/outbound links are in the "Links" category (not "Technical SEO")

### Test Flow C — Keyword Persistence

1. Complete an analysis for URL `https://example.com` with keyword `test`
2. Click "New Analysis"
3. **Verify** the keyword field is pre-filled with `test` (loaded from localStorage per-host)

### Test Flow D — Copy Interactions

1. Complete analysis with some failing checks
2. Expand a failing check that has an `EditableRecommendation`
3. Type custom text in the textarea
4. Click the copy button
5. **Verify** the button changes to a green checkmark for ~2 seconds
6. **Verify** a toast notification appears at the bottom center saying "Copied to clipboard"
7. **Verify** the toast auto-dismisses after ~3 seconds

### Test Flow E — Schema Display

1. In advanced mode, select page type "Product page"
2. Run analysis
3. Navigate to "Technical SEO" → expand "Schema markup" check
4. **Verify** SchemaDisplay shows:
   - "Required" section with "Product" schema
   - "Optional" section with "FAQPage" schema
   - Each schema card is collapsible
   - Expanded card shows description, JSON-LD code block, copy button, documentation link
   - Google support badge: "Rich Results" (green) for Product, "Rich Results" (green) for FAQPage
5. Click copy on a schema — verify it copies `<script type="application/ld+json">...</script>` wrapped code

### Test Flow F — Confetti

1. Find or construct a scenario where overall score ≥ 70
   - Tip: `https://en.wikipedia.org/wiki/Search_engine_optimization` with keyword `SEO` should score well
2. **Verify** confetti animation fires when the score page renders
3. Navigate away and back — confetti should NOT fire again (guarded by ref)

### Test Flow G — Error Boundary

1. Open browser DevTools console
2. Intentionally trigger an error (e.g., manually dispatch an invalid state)
3. **Verify** the ErrorBoundary catches it and shows "Something went wrong" with a "Try Again" button

### Functional Test Checklist

Report pass/fail for each:
- [ ] Onboarding overlay shows on first launch, persists dismissal
- [ ] URL + keyword required to enable button (dev mode)
- [ ] Loading state renders correctly
- [ ] Score page shows 5 categories with correct labels
- [ ] Category scores add up (passed + failed = total per category)
- [ ] Checks sorted by priority within each category
- [ ] Badge colors map correctly to status + priority
- [ ] Copyable checks show EditableRecommendation when failing (no API key = still shows placeholder)
- [ ] H2SelectionList renders for h2-keyword check with all H2s listed
- [ ] ImageAltTextList renders for images-alt check with missing-alt images
- [ ] SchemaDisplay renders for schema-markup with correct page-type schemas
- [ ] Copy button → green check + toast
- [ ] Toast auto-dismisses
- [ ] Confetti fires at score ≥ 70
- [ ] Keyword persisted per URL host
- [ ] Advanced options (page type, language, secondary keywords) persist per host
- [ ] 16 page types in dropdown
- [ ] 9 languages with flag emojis in dropdown
- [ ] Content length threshold: 300 for homepage, 600 for other page types
- [ ] Links category exists separately from Technical SEO
- [ ] ErrorBoundary catches render errors

---

## Part 3: Code Review

Read the following files and review for correctness, consistency, and bugs:

### Core Logic Files
| File | What to Check |
|------|---------------|
| `app/src/types/seo.ts` | All types are used; no orphan fields; `CheckCategory` includes `"links"`; `CheckPriority` includes `"medium"` |
| `app/src/lib/seo-analyzer.ts` | All 25 checks have unique IDs; categories assigned correctly; `containsKeywordWB` uses word-boundary regex; secondary keywords passed through; keyphrase density math is correct; heading hierarchy logic handles edge cases; `groupChecksByCategory` includes `links` key |
| `app/src/lib/scoring.ts` | 5 category weights sum to 1.0 (0.25+0.25+0.15+0.15+0.20); `categoryLabels` and `categoryWeights` both have `links` key |
| `app/src/lib/openai.ts` | All check IDs in the switch statement match IDs from seo-analyzer; retry logic works (exponential backoff 2s, 4s); max_tokens=500; model=gpt-4o-mini; language instruction injected for non-English |
| `app/src/lib/languages.ts` | 9 languages match spec; `detectLanguage` extracts base code from `en-US` style strings |
| `app/src/lib/schema-recommendations.ts` | All 16 page types present; JSON-LD is valid JSON (check for syntax errors in template strings); `getSchemaRecommendations` returns empty array for unknown page types |
| `app/src/lib/storage.ts` | `saveKeywordForUrl` / `getKeywordForUrl` use hostname keying; `saveAdvancedOptions` / `getAdvancedOptions` round-trip correctly |
| `app/src/lib/store.ts` | Default settings match expected defaults; `toast` state wired; `reset()` clears analysis but not API key |
| `app/src/content/analyzer.ts` | Extracts paragraphs, resources, schemaMarkup, ogImage; returns `imageFileSizes: []` |
| `app/src/lib/fetch-page.ts` | Mirrors content/analyzer.ts extraction fields; resolves relative URLs |

### UI Component Files
| File | What to Check |
|------|---------------|
| `app/src/components/EditableRecommendation.tsx` | Copy + regenerate callbacks; textarea editable; copied state resets after 2s |
| `app/src/components/H2SelectionList.tsx` | "Generate All" triggers parallel generation; per-H2 regenerate works independently; copy disabled when no suggestion |
| `app/src/components/ImageAltTextList.tsx` | Image thumbnail has error handler; copy disabled when no alt text; generate calls onGenerate with correct src |
| `app/src/components/SchemaDisplay.tsx` | Copy wraps in `<script>` tags; required/optional grouping; Google support badge colors correct |
| `app/src/components/ErrorBoundary.tsx` | Class component with getDerivedStateFromError; "Try Again" resets state |
| `app/src/components/Onboarding.tsx` | Reads/writes `onboarding_dismissed` from storage; dismiss persists |
| `app/src/components/ui/Badge.tsx` | Handles "medium" priority; label text correct for all combinations |
| `app/src/components/SummaryCard.tsx` | Shows category label, passed/failed counts |

### Page Files
| File | What to Check |
|------|---------------|
| `app/src/sidepanel/pages/SetupPage.tsx` | 16 page types; 9 languages from SUPPORTED_LANGUAGES; flag emojis render |
| `app/src/sidepanel/pages/ScorePage.tsx` | Confetti fires once (useRef guard); threshold is ≥70; 5 category cards rendered |
| `app/src/sidepanel/pages/SubscoresPage.tsx` | Checks sorted by priority; renderCheckRecommendation covers all special check IDs; advancedOptions passed to AI functions; SchemaDisplay receives schemas for current pageType |
| `app/src/sidepanel/App.tsx` | Keyword persistence on analyze; auto-detect language; ErrorBoundary wraps everything; Onboarding rendered; inline extraction script includes paragraphs, resources, schemaMarkup, ogImage, imageFileSizes |

### Code Review Checklist

- [ ] No unused imports or variables (TypeScript strict mode)
- [ ] All check IDs in seo-analyzer.ts are unique
- [ ] All check IDs referenced in SubscoresPage.tsx exist in seo-analyzer.ts
- [ ] All check IDs in openai.ts switch statement exist in seo-analyzer.ts
- [ ] Category weights sum to exactly 1.0
- [ ] `groupChecksByCategory` has all 5 category keys
- [ ] Inline extraction script in App.tsx matches content/analyzer.ts (same fields)
- [ ] fetch-page.ts mirrors content/analyzer.ts (same fields)
- [ ] No hardcoded colors — all use Tailwind tokens
- [ ] Copy-to-clipboard calls `navigator.clipboard.writeText()` (not DOM injection)
- [ ] All `async` functions have error handling
- [ ] No `any` types
- [ ] Schema JSON-LD templates are valid JSON (no trailing commas, proper quoting)
- [ ] Language flag emojis render correctly (Unicode escape sequences)

---

## Output Format

Produce your report in this structure:

```markdown
# Optia — QA Report

## 1. Visual Comparison

### Screen: [Screen Name]
**Figma Match:** ✅ Matches / ⚠️ Minor differences / ❌ Major mismatch
**Details:** [specific differences with screenshots]

[Repeat for each screen]

### Visual Diff Summary
| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| ... | ... | ... | ... |

## 2. Functional Testing

### Test Flow: [Flow Name]
| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| ... | ... | ... | ✅/❌ |

[Repeat for each flow]

### Functional Test Summary
- Total tests: X
- Passed: X
- Failed: X
- Blocked: X

## 3. Code Review

### Issues Found
| Severity | File | Line(s) | Description | Suggested Fix |
|----------|------|---------|-------------|---------------|
| 🔴 Bug | ... | ... | ... | ... |
| 🟡 Warning | ... | ... | ... | ... |
| 🔵 Nit | ... | ... | ... | ... |

### Code Review Summary
- Critical bugs: X
- Warnings: X
- Nits: X

## 4. Overall Assessment
[2-3 sentence summary of readiness]
```

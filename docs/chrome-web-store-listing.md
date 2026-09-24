# Chrome Web Store Listing

Source of truth for everything entered in the CWS Developer Dashboard. Keep this in sync with the product — the previous version of this file described the pre-freemium OpenAI/BYO-only build and must not be resubmitted.

## Extension Name

Optia

## Short Description (132 chars max)

Analyze any page's SEO and get an instant score with AI-powered title, meta description, and alt text recommendations.

## Category

Productivity → SEO & marketing tools

## Language

English (Pro adds multi-language AI output; the listing itself is English)

## Detailed Description

Optia analyzes any web page for SEO issues and gives you a clear score with actionable recommendations — powered by AI.

Enter your target keyword, click "Optimize my SEO," and instantly see what's working and what needs improvement across your titles, meta descriptions, headings, images, links, structured data, and more. Each check is labeled by priority (High, Medium) so you know exactly where to focus first.

**FEATURES**

— Instant SEO scoring: A visual score from 0–100 with a clear breakdown of passed checks vs. items to improve. Unlimited, on every page.

— Keyword optimization tracking: See how your target keyword is used across your title, meta description, headings, URL, image alt text, and body content.

— AI-powered recommendations: One-click suggested titles, meta descriptions, H2 headings, and image alt text tailored to your page content and keyword — served by Claude (Anthropic). Free users get 25 AI recommendations every month, no account or API key required.

— Priority-labeled checks: Every issue is tagged High or Medium priority so you fix the right things first.

— One-click copy: Copy any AI suggestion straight to your clipboard.

— Detailed check categories: Meta Tags, Headings, Images, Links, Content Quality, Structured Data (JSON-LD), Open Graph, and Twitter Cards.

— Works on any website: Analyze any live page in your browser — not limited to any specific platform.

— Side panel UI: Runs neatly in Chrome's side panel so you can see recommendations alongside the page you're optimizing. Light and dark themes.

**OPTIA PRO — $5/month or $50/year (2 months free)**

— 1,000 AI recommendations per month (40× the free allowance)

— Bring your own Anthropic API key for unlimited AI: your key is stored only in your browser and used for direct calls to Anthropic — it never touches our servers

— Advanced Analysis mode: page-type-aware recommendations (Homepage, Blog Post, Product Page, and 13 more)

— Multi-language AI output

— Structured data (schema) recommendations

Note: Optia Pro is purchased from us and billed securely through Stripe — not through the Chrome Web Store. Google is not the merchant of record. Activate on any browser with your license key; manage or cancel any time from the extension's options page via the Stripe billing portal.

**PRIVACY FIRST**

All SEO analysis happens locally in your browser. When you request an AI recommendation, only the relevant page snippets (like the current title and your keyword) are sent to our AI service to generate the suggestion — nothing else, and never in the background. No accounts required for the free tier. No tracking, no ads, no analytics, and your data is never sold. Pro users who bring their own Anthropic key talk to Anthropic directly; the key never leaves the browser.

Full privacy policy: https://pmdevsolutions.github.io/Optia/privacy.html

## Privacy Policy URL

https://pmdevsolutions.github.io/Optia/privacy.html

(Served from `site/privacy.html` via the Deploy Site workflow — GitHub Pages, allowed by CWS. Keep `site/` and `docs/privacy-policy.md` in sync.)

## Website / Support URL

- Website: https://pmdevsolutions.github.io/Optia/ (landing page in `site/`; `pmds.info` can replace it later once it mentions Optia)
- Support: https://github.com/PMDevSolutions/Optia/issues

---

## External Payments Disclosure

Chrome Web Store policy requires honest disclosure of paid features: the listing copy above states that Pro is a paid upgrade billed externally via Stripe (Google no longer processes extension payments). Keep this disclosure in the detailed description whenever the copy is edited — omitting it risks review rejection or takedown (see issue #14).

## Single Purpose Statement (Dashboard field)

Optia's single purpose is on-page SEO analysis: it scores the page the user is viewing against SEO best practices for a keyword the user provides, and generates suggested improvements (titles, meta descriptions, headings, alt text) on request.

## Permission Justifications (Dashboard fields)

| Permission | Justification |
|---|---|
| `tabs` | Identify the active tab so the side panel analyzes the page the user is viewing, and detect navigation to refresh results. |
| `sidePanel` | Optia's entire UI runs in Chrome's side panel, opened from the toolbar action. |
| `storage` | Store the user's settings, keyword history, license entitlement, and (Pro) their own API key locally. Nothing is synced or transmitted. |
| `scripting` | Inject the analysis content script that reads the page's SEO elements and optionally highlights issues in place. |
| `alarms` | Periodically refresh the Pro license entitlement token in the background. |
| Host access `<all_urls>` | The user can analyze any page they choose to open; the content script must be able to read the DOM of that page. It extracts SEO data only when the user runs an analysis. |
| Remote code | None — all code ships in the package; the extension calls remote APIs (our backend / Anthropic) for data only. |

Note: `<all_urls>` puts the listing in the in-depth review queue. See `docs/launch-checklist.md` for the accepted trade-off and the decision record on not narrowing to `activeTab`.

## Data Disclosure

Answers for the Dashboard's Privacy practices tab live in `docs/chrome-web-store-data-disclosure.md`.

---

## Asset Checklist

| Asset | Spec | Status |
|---|---|---|
| Store icon | 128×128 PNG (generated from `app/public/icons/icon-128.svg` by `pnpm icons`, ships in `dist/icons/`) | ✅ exists |
| Screenshots (1–5) | 1280×800 or 640×400 PNG/JPEG, no transparency | ✅ `marketing/store-assets/out/screenshot-{1..5}-*.png` (score, checks, setup, Pro paywall, options/BYO-key) |
| Small promo tile | 440×280 PNG/JPEG (shown in search/category) | ✅ `marketing/store-assets/out/promo-tile-440x280.png` |
| Marquee promo tile | 1400×560 (optional, featured placements) | ⬜ optional |

Assets are generated from real UI captures: `node marketing/store-assets/capture.mjs` (needs `pnpm dev` running and a built `app/dist`) then `render-asset.mjs` frames them — see `marketing/store-assets/README.md`. Screenshot 4 shows the Pro paywall, satisfying the "upgrade surface" requirement of issue #14; its caption repeats the Stripe external-billing disclosure.

---

## Tuning pass, 2026-09-24 (proposed, not yet applied in the dashboard)

Google Task "OPTIA: CWS listing optimization pass + review asks" (due 2026-09-23). The dashboard
could not be edited on 2026-09-24: the developer console asks paul@pmds.info to sign in again
in the automation Chrome. The text above stays the source of truth until the change below is
applied there; then move it up and delete this section.

**Data available.** Last dashboard read 2026-09-21 (Maecenas
`.claude/research/optia/2026-09-21-one-month-numbers.md`): 30 days, 47 installs from 28 listing
page views and 26 store impressions, 1 uninstall, average 3 weekly users, 55% of installs on
ChromeOS while no weekly user runs ChromeOS. Public listing 2026-09-24: 7 users, 5.0 from one
rating, no written reviews. Installs exceed page views, so the install count is mostly automated
and there is no usable impression-to-install signal yet. This pass is keyword-driven, not
performance-driven.

**Short description.** Current (121 characters): `Analyze any page's SEO and get an instant
score with AI-powered title, meta description, and alt text recommendations.`

Proposed (120 characters, limit 132):

`Free on-page SEO checker. Score any page for your keyword, then get AI title, meta description and alt text suggestions.`

Why, from the 2026-09-22 Keyword Planner pull (US, 12-month averages, Maecenas
`.claude/research/optia/2026-09-22-keyword-planner-optia.md`): "check my website seo" 1,000/mo,
"seo score checker" 720, "on page seo tool" 720, "free seo audit tool" 720, "website seo
checker free" 590, "on page seo checker" 480, "meta description checker" 480, "alt text
generator" 2,900. The words "checker", "on-page", "free", "score" and "keyword" are what people
type; "analyze" and "instant" are not. "Free" is accurate (25 AI recommendations a month, scoring
unlimited). Pro and Stripe wording are untouched; the external-payments disclosure in the
detailed description stays as is.

**Screenshot order.** Current: 1 score, 2 checks, 3 setup, 4 Pro paywall, 5 options and BYO key.
Proposed: 1 score, 2 checks, 3 options and BYO key (the privacy and own-key angle is the one
differentiator outside commenters have named), 4 setup, 5 Pro paywall last. A judgment call with
no data behind it; revisit when the dashboard shows real page views.

**Review asks.** Pinned issue #68 asks satisfied users for an honest Chrome Web Store review, with
no incentive, and points bug reports to issues instead. The Monday LinkedIn Optia post can carry
one plain sentence ("if you use it, an honest review helps") once a week at most. Nothing traded,
nothing scripted, no review requests to people who have not said they use it.

**To apply (dashboard, after re-verification):** Store listing > Description > Short description;
Store listing > Graphic assets > reorder screenshots; save and submit. No new version is needed
for either change.

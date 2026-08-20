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

# Optia Privacy Policy

**Effective date:** 2026-08-20
**Last updated:** 2026-10-24

> Published at **https://pmdevsolutions.github.io/Optia/privacy.html** (rendered from `site/privacy.html` — keep the two in sync; the HTML version is the user-facing one). Grounded in the extension's actual data flows (see `docs/free-vs-pro-gating.md` and the backend design records). **A qualified lawyer's review is still recommended** — tracked in `docs/launch-checklist.md` Phase 0.

Optia ("we", "our") is a Chrome extension that analyzes web pages for SEO issues and generates AI-powered recommendations. This policy explains what data Optia handles, where it goes, and the choices you have.

## The short version

- SEO analysis runs **locally in your browser**. Pages you visit are not sent anywhere just by browsing.
- When you explicitly request an AI recommendation, the relevant page snippets are sent to our AI service (or directly to Anthropic if you use your own API key) to generate the suggestion.
- At most once a day, Optia sends us one **anonymous usage count**: a random install ID, the month, and how many pages you analyzed that month. No URLs, page content, keywords or scores. You can turn it off in Optia's options.
- We require **no account** for the free tier, and we use **no analytics services, no ads, and no trackers**. We never sell your data.
- Your own Anthropic API key (Pro option) is stored only in your browser and **never sent to our servers** — this is enforced server-side: our backend does not accept caller API keys.

## Data we handle, and where it goes

### 1. Page content you analyze (stays local by default)

When you run an analysis, Optia's content script reads the current page's SEO-relevant elements (title, meta tags, headings, image alt attributes, link structure, body text) **inside your browser** and computes the score locally. This data is not transmitted. Running an analysis adds one to the monthly count described in section 4; nothing about the page itself goes with it.

### 2. AI recommendation requests (sent only when you click)

When you request an AI suggestion, Optia sends the minimum needed to generate it — your target keyword and the relevant page snippet (e.g., the current title, a heading, or an image reference), plus the page-type/secondary-keyword context you optionally configured:

- **Hosted mode (default, free and Pro):** sent to our backend (`api.optia-api.com`, Cloudflare Workers), which forwards it to Anthropic's Claude API to generate the suggestion. Our backend meters usage counts; it does not build profiles from request content. Anthropic processes the snippets as our AI provider ([Anthropic's privacy policy](https://www.anthropic.com/legal/privacy)).
- **Bring-your-own-key mode (Pro):** sent directly from your browser to Anthropic using your key. Our servers are not involved at all.

### 3. Install identifier

Your extension generates a random install ID. It is sent with hosted AI requests, where it meters the monthly allowance; with Pro checkout and license activation, where it ties a license seat to this browser; and with the usage count in section 4. It is not linked to your identity and resets if you reinstall.

### 4. Anonymous usage count (on unless you turn it off)

Optia counts the pages you analyze each month, on your device. At most once a day, after you run an analysis, it sends that count to our backend (`api.optia-api.com`). The report contains only three things: your install ID, the month (for example `2026-11`), and how many pages you have analyzed that month. It never contains URLs, page content, keywords or scores. This applies on every plan. We use the counts to see how much Optia is used, so the free tier's limits are set from real numbers. To stop the reports, turn off **Share anonymous usage counts** in Optia's options. Optia keeps counting on your device, so the options page can still show you the number, but sends nothing.

### 5. License and billing data (Pro only)

If you purchase Optia Pro, checkout and payment are handled by **Stripe** — we never see your card details ([Stripe's privacy policy](https://stripe.com/privacy)). Our backend stores what's needed to operate your license: your license key, subscription status, and billing-portal linkage. Activating Pro stores a signed entitlement token in your browser, refreshed periodically.

### 6. Your Anthropic API key (Pro, optional)

Stored only in Chrome's local extension storage on your device. Used exclusively for direct browser→Anthropic requests. Never transmitted to our backend, logged by us, or synced.

### 7. Settings and history (local)

Your keyword history, per-site options, language preference, and toggles are stored in Chrome's local extension storage on your device. Nothing is synced to us.

## What we don't do

- No analytics or telemetry SDKs, no advertising, no tracking pixels or cookies in the extension.
- No selling, renting, or sharing of user data with data brokers.
- No collection of browsing history — Optia only touches pages where you actively run an analysis.
- No use of your data to train AI models by us. (Hosted requests are processed by Anthropic under our provider agreement.)

## Data retention

- Local data (settings, keys, entitlement tokens): retained until you clear it or uninstall the extension.
- Backend usage counters (AI requests per install ID or license, and pages analyzed per install ID): kept as one total per month, for billing, abuse prevention and setting the free tier's limits.
- Backend request logs: operational logs are short-lived and used for reliability and abuse prevention, not profiling. <!-- TODO(legal review): confirm exact log-retention window with the backend's Cloudflare configuration. -->

## Your rights

Depending on your jurisdiction (GDPR, UK GDPR, CCPA/CPRA, and similar), you may have rights to access, correct, delete, or export data we hold about you. Because Optia holds almost nothing server-side, deletion typically means: cancel your subscription (Stripe/billing portal), deactivate your license, and uninstall the extension. To exercise any right, contact us at the address below.

## Children

Optia is not directed at children under 13 and we do not knowingly collect their data.

## Changes

We will update this policy as the product evolves and revise the "Last updated" date. Material changes will be noted in the extension's release notes.

## Contact

<!-- TODO: support email address for privacy inquiries, e.g. privacy@optia-api.com or the maintainer's contact. -->

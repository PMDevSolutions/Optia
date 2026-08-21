# Optia v1.0.0 — Release Notes (draft)

> Draft for the GitHub Release body and the Chrome Web Store "What's new" field when 1.0.0 ships (cut it by landing a `Release-As: 1.0.0` commit footer and merging the Release PR — see `docs/RELEASING.md`).

## Optia 1.0.0 — the freemium launch

Optia analyzes any page's SEO and now ships with a built-in free AI tier — no account, no API key, no setup.

**Free for everyone**
- Unlimited on-page SEO analysis: a 0–100 score across 18 priority-labeled checks (meta, headings, images, links, content, structured data, Open Graph, Twitter Cards)
- 25 AI recommendations every month, powered by Claude (Anthropic) — optimized titles, meta descriptions, H2s, and image alt text, one click to copy
- Runs in Chrome's side panel, light and dark themes, everything analyzed locally in your browser

**Optia Pro — $5/month or $50/year**
- 1,000 AI recommendations a month
- Bring your own Anthropic API key for unlimited AI (stored only in your browser, sent only to Anthropic)
- Advanced page-type-aware analysis with secondary keywords
- Multi-language AI output
- Schema (JSON-LD) recommendations
- Checkout and billing handled securely by Stripe; licenses activate automatically after payment

**Privacy first**
- No accounts for the free tier, no analytics, no tracking, no ads
- AI requests send only your keyword and the relevant page snippet — nothing else, never in the background
- Full policy: https://pmdevsolutions.github.io/Optia/privacy.html

**Under the hood**
- Manifest V3 with a pinned extension ID, Ed25519-signed license entitlements verified client-side, server-metered quotas, and a 500+ test suite including loaded-extension E2E and MV3 compliance checks

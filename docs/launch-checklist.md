# Chrome Web Store Launch Checklist

The end-to-end path from this repo to a live, working, paid product. Backend steps reference `optia-backend/docs/PROVISIONING.md` (the go-live runbook). Work top to bottom; phases 1–3 can proceed in parallel, phase 4 depends on all of them.

**Key fact:** the manifest's `key` field pins the extension ID to **`lgkgkmjldppeidgafolhfpepmabnnbhe`** for local loads *and* the store (the key ships in the upload zip). That means the backend's CORS allowlist can be configured **before** submission — there is no wait-for-the-store-ID step.

## Phase 0 — Decisions (block everything else)

- [ ] **Host permissions**: keep `<all_urls>` (any-site analysis, in-depth CWS review accepted) or narrow to `activeTab` + `scripting` (faster review, but changes UX — content script must be injected on demand). Current decision: **keep `<all_urls>`**; record any change here and in the listing's permission justifications.
- [x] **Privacy hosting + website**: **decided 2026-08-20 — GitHub Pages.** Landing page + privacy policy live in `site/`, deployed by the Deploy Site workflow to https://pmdevsolutions.github.io/Optia/ (privacy: `/privacy.html`); support = repo issues. Context: the only Optia domain owned is `optia-api.com` (Cloudflare, 2026-07-18, API only); `optia.com` is not ours; `pmds.info` is the business site but doesn't mention Optia yet — either can take over the website slot later (update the CWS listing and Stripe business profile if so).
- [ ] **Privacy contact email** (optional refinement): the published policy currently points to GitHub issues for contact; add a dedicated email (e.g. on `pmds.info` or `optia-api.com`) if preferred.
- [ ] **Legal review** of `docs/privacy-policy.md` (drafted with the `legal-advisor` agent; flagged TODOs inside).

## Phase 1 — Extension readiness

- [x] Merge PR #28 (BYOK toggle + invalid-key fallback — closed #12, merged 2026-08-20).
- [x] CI fully green on `main`, including the **Extension E2E (MV3)** job (`app/e2e/` — MV3 compliance + loaded-extension smoke tests).
- [ ] **Substitute production Stripe price IDs** in `app/src/lib/plans.ts` — the literals `__OPTIA_LIVE_PRICE_PRO_MONTHLY__` / `__OPTIA_LIVE_PRICE_PRO_ANNUAL__` must be replaced before the release build. ⚠️ **Dashboard-verified 2026-08-20: the "live" IDs in `optia-backend/wrangler.toml` (`price_1TucPn…` / `price_1TucPp…`) do not exist in the Optia Stripe account and appear stale/foreign — do not trust them.** Real live prices can only be created after account activation (see Phase 2), then propagated to BOTH `wrangler.toml` and `plans.ts`.
- [ ] **Bundle the production entitlement public key**: the extension verifies entitlements against the environment's signing key — confirm `ENTITLEMENT_JWKS` in `app/src/lib/entitlement-keys.ts` contains the **production** key (`GET https://api.optia-api.com/license/public-key`) for production builds, not staging's.
- [ ] Confirm `BACKEND_BASE_URL` resolves to `https://api.optia-api.com` in the production build (Vite mode), never staging/localhost.
- [ ] Manual QA sweep of the built extension (load `app/dist` unpacked): free analysis, free AI (quota ticks down), paywall → Stripe test checkout, license activation, Pro features, BYOK path, options page.

## Phase 2 — Backend go-live (`optia-backend`)

**Stripe state as verified in the dashboard on 2026-08-20:** the live account (`acct_1U6Z2iRDHttKIwLT`) is still **in onboarding — "Verify your business" is incomplete, so it cannot take live payments**; the "Optia sandbox" has **no webhook endpoints** and no billing-portal configuration. Order of operations for Stripe (owner-only where noted):

- [ ] Complete live account activation (business verification, bank account) — **owner-only, blocks everything below**
- [ ] Create the Pro product + $5/month and $50/year prices in **live mode**; put the real IDs in `optia-backend/wrangler.toml` (production) and `app/src/lib/plans.ts`
- [ ] Create the live webhook endpoint → `api.optia-api.com` (events per `optia-backend` Stripe design doc) and set its signing secret as a production secret
- [ ] Configure the Billing Portal in live mode (the extension's "Manage billing" depends on it)
- [ ] Also wire the missing **sandbox** webhook + portal for staging parity

Follow `docs/PROVISIONING.md` §1–§8 for the production environment:

- [ ] D1 `optia-db-production` created + migrations applied (`pnpm db:migrate:production`).
- [ ] KV `RATE_LIMIT` bound; production secrets set (Anthropic key, Stripe live secret + webhook secret, signing private key).
- [ ] **CORS**: replace `chrome-extension://__OPTIA_EXTENSION_ID__` with `chrome-extension://lgkgkmjldppeidgafolhfpepmabnnbhe` in `wrangler.toml` `ALLOWED_ORIGINS` (all three envs reference it; production matters for launch) — can be done now thanks to the pinned ID.
- [ ] Stripe live-mode webhook endpoint pointed at `api.optia-api.com` and verified.
- [ ] Deploy production with a real `COMMIT_SHA` (`pnpm deploy:production` per the runbook — the `"UNSET"` sentinel in `/health` means the override was forgotten).
- [ ] Smoke: `/health`, `/license/public-key`, one metered `POST /ai/generate` from a production build, one full checkout → activation with a live card (then refund).

## Phase 3 — Store package, listing, legal

- [x] Cut the release: **v0.2.0 released 2026-08-20** with `optia-0.2.0.zip` attached (manually — releases created by the default `GITHUB_TOKEN` don't trigger `on: release` workflows; the zip now builds inside the release-please workflow itself, so future releases attach automatically). Re-cut releases per `docs/RELEASING.md`.
- [x] Render store assets (`marketing/store-assets/README.md`): five 1280×800 screenshots (incl. the Pro/upgrade surface) and the 440×280 promo tile are committed in `marketing/store-assets/out/`; re-run `capture.mjs` + `render-asset.mjs` after UI changes.
- [ ] Listing copy finalized from `docs/chrome-web-store-listing.md` (short + detailed description, category, single-purpose statement, permission justifications).
- [ ] Privacy policy hosted; URL pasted into the listing doc and dashboard.
- [ ] Privacy-practices form answered from `docs/chrome-web-store-data-disclosure.md`.

## Phase 4 — Submission

- [ ] CWS developer account ready ($5 one-time fee paid) at the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
- [ ] Upload the release zip; fill listing, privacy, and distribution tabs from the docs above.
- [ ] Verify the dashboard shows item ID `lgkgkmjldppeidgafolhfpepmabnnbhe` (it honors the manifest `key`). If it ever differs, update the backend `ALLOWED_ORIGINS` and redeploy before publishing.
- [ ] Submit for review. Expect the **in-depth queue** because of `<all_urls>` — reviews commonly take days, occasionally longer. Respond to reviewer emails promptly; rejections cite the exact policy.

## Phase 5 — Post-publish

- [ ] Install from the store on a clean Chrome profile; re-run the Phase 1 manual QA sweep against production (free AI, checkout with a live card + refund, activation, BYOK).
- [ ] Confirm no CORS errors from the store-installed extension (proves the `ALLOWED_ORIGINS` entry).
- [ ] Fill the `[Chrome Web Store link]` placeholders in `docs/launch-social-posts.md` and post.
- [ ] Watch the first reviews/support requests; the dashboard's user-feedback tab and Stripe's dashboard are the two inboxes that matter in week one.
- [ ] Ongoing: every future upload's `manifest.json` version must be greater than the published one — versions only move via the Release PR.

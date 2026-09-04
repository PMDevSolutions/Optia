# Chrome Web Store Launch Checklist

The end-to-end path from this repo to a live, working, paid product. Backend steps reference `optia-backend/docs/PROVISIONING.md` (the go-live runbook). Work top to bottom; phases 1–3 can proceed in parallel, phase 4 depends on all of them.

**Key fact:** the manifest's `key` field pins the extension ID to **`lgkgkmjldppeidgafolhfpepmabnnbhe`** for local loads *and* the store (the key ships in the upload zip). That means the backend's CORS allowlist can be configured **before** submission — there is no wait-for-the-store-ID step.

## Phase 0 — Decisions (block everything else)

- [ ] **Host permissions**: keep `<all_urls>` (any-site analysis, in-depth CWS review accepted) or narrow to `activeTab` + `scripting` (faster review, but changes UX — content script must be injected on demand). Current decision: **keep `<all_urls>`**; record any change here and in the listing's permission justifications.
- [x] **Privacy hosting + website**: **decided 2026-08-20 — GitHub Pages.** Landing page + privacy policy live in `site/`, deployed by the Deploy Site workflow to https://pmdevsolutions.github.io/Optia/ (privacy: `/privacy.html`); support = repo issues. Context: the only Optia domain owned is `optia-api.com` (Cloudflare, 2026-07-18, API only); `optia.com` is not ours; `pmds.info` now has a product page at https://pmds.info/products/optia (live 2026-09-02, with homepage card, nav link, sitemap entry, SoftwareApplication JSON-LD) — **CWS listing switched 2026-09-04:** Homepage URL now https://pmds.info/products/optia and Official URL set to the Search Console-verified `pmds.info` (listing resubmitted for review, auto-publish on; privacy policy URL stays on GitHub Pages). Stripe live account business website switched to the same URL on 2026-09-04.
- [ ] **Privacy contact email** (optional refinement): the published policy currently points to GitHub issues for contact; add a dedicated email (e.g. on `pmds.info` or `optia-api.com`) if preferred.
- [ ] **Legal review** of `docs/privacy-policy.md` (drafted with the `legal-advisor` agent; flagged TODOs inside).

## Phase 1 — Extension readiness

- [x] Merge PR #28 (BYOK toggle + invalid-key fallback — closed #12, merged 2026-08-20).
- [x] CI fully green on `main`, including the **Extension E2E (MV3)** job (`app/e2e/` — MV3 compliance + loaded-extension smoke tests).
- [x] **Production Stripe price IDs substituted** in `app/src/lib/plans.ts` (2026-08-20): monthly `price_1U6faNRDHttKIwLT8gOTOVIe` ($5), annual `price_1U6flvRDHttKIwLTjOIPGpVG` ($50), created live on `acct_1U6Z2iRDHttKIwLT` (product `prod_V6tNs5AY55KP6R`). The old `price_1Tuc…` IDs were stale/foreign and are replaced in `optia-backend/wrangler.toml` too.
- [x] **Production entitlement public key bundled** — verified 2026-08-20: `entitlement-keys.ts` kid `7nwkI8jgmbJnMjWEZXnEIdd53-DlDXdARJxVhTOmDnQ` matches the live `GET https://api.optia-api.com/license/public-key` exactly.
- [x] `BACKEND_BASE_URL` resolves to `https://api.optia-api.com` in production builds (verified in `entitlement-keys.ts` mode switch).
- [x] Manual QA sweep per **`docs/qa-checklist-v1.md`** — **completed 2026-08-21** (issue #16 closed): full freemium flow live-driven against staging + production (checkout, Pro unlock, claim resume, BYOK incl. invalid-key fallback, multi-language, downgrade, offline, SW kill, restart persistence; light + dark at 360/500px; zero console errors). Seven defects found and fixed (Optia #45/#47/#49/#51, optia-backend #22/#23/#24). **v1.0.0 cut 2026-08-21** (`optia-1.0.0.zip` attached to the release).

## Phase 2 — Backend go-live (`optia-backend`)

**Stripe state as verified in the dashboard on 2026-08-20:** the live account (`acct_1U6Z2iRDHttKIwLT`) is still **in onboarding — "Verify your business" is incomplete, so it cannot take live payments**; the "Optia sandbox" has **no webhook endpoints** and no billing-portal configuration. Order of operations for Stripe (owner-only where noted):

- [x] Live account activation **submitted 2026-08-20** (entity: PMDS sole prop; public name Optia; statement descriptor `OPTIA`; category SaaS; PNC payouts). Stripe review in progress (2–3 days) — live charges enable when it clears.
- [x] Pro product + prices created in live mode (2026-08-20): `prod_V6tNs5AY55KP6R`, monthly `price_1U6faNRDHttKIwLT8gOTOVIe`, annual `price_1U6flvRDHttKIwLTjOIPGpVG` (lookup keys `optia_pro_monthly`/`optia_pro_annual`); IDs propagated to `wrangler.toml` + `plans.ts`.
- [x] Live webhook endpoint created: `we_1U6frWRDHttKIwLTMQgb9FU9` → `https://api.optia-api.com/billing/webhook` (checkout.session.completed, customer.subscription.updated/deleted). ⚠️ Destination API version is `2026-07-29.dahlia`; backend pins `2026-06-24.dahlia` — same family, verify event shapes in staging or align the pin.
- [x] Webhook signing secret set as `STRIPE_WEBHOOK_SECRET` production secret (owner, 2026-08-20; verified present via `wrangler secret list`)
- [x] Billing Portal configured in live mode (default configuration `bpc_1U6…` saved — what `/billing/portal` sessions use)
- [x] Sandbox webhook + portal verified working end-to-end 2026-08-21 (staging checkout minted a license via the webhook; portal session opened) — the #16 QA pass exercised both. The live-endpoint API-version note above is de-risked the same way: the sandbox destination processed `checkout.session.completed` and `customer.subscription.deleted` with the current pin.

Follow `docs/PROVISIONING.md` §1–§8 for the production environment:

- [x] D1 `optia-db-production` created + migrations applied (verified 2026-08-20: `wrangler d1 migrations list … --remote` → none pending).
- [x] KV `RATE_LIMIT` bound; all five production secrets set (`ANTHROPIC_API_KEY`, `OPS_TOKEN`, `SIGNING_PRIVATE_JWK`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- [x] **CORS**: `ALLOWED_ORIGINS` carries `chrome-extension://lgkgkmjldppeidgafolhfpepmabnnbhe` in all three envs.
- [x] Live webhook endpoint pointed at `api.optia-api.com/billing/webhook` (`we_1U6frWRDHttKIwLTMQgb9FU9`).
- [x] **Production deployed 2026-08-20** (`pnpm exec wrangler deploy --env production --var COMMIT_SHA:…` — note: `pnpm deploy:production -- --var …` does NOT forward the var; call wrangler directly). `/health` reports the real commit.
- [x] Smoke passed 2026-08-20: `/health` healthy + DB connected, `/license/public-key` serves the bundled key, one metered `POST /ai/generate` returned a real Claude recommendation. ⏳ Remaining: one full live-card checkout → activation → refund, **after Stripe's account review clears** (2–3 days).
- [x] ~~🚨 BLOCKER found 2026-08-23~~ **found and FIXED 2026-08-23:** production `POST /billing/checkout` returned 500 — Worker logs showed Stripe rejecting with `No such price: 'price_1U6fa…'`. Root cause: the production **`STRIPE_SECRET_KEY` secret belonged to the wrong Stripe account** (stale Optia Sandbox key; confirmed because the live account's secret key had never been revealed). Fixed by revealing the live key (acct_1U6Z2iRDHttKIwLT) and re-running `wrangler secret put STRIPE_SECRET_KEY --env production`. The 8/20 smoke test missed it because it never exercised billing — future deploy checklists should include one `POST /billing/checkout` smoke call.
- [x] **Live checkout → activation → refund test PASSED 2026-08-23:** real $5 card payment on a live Checkout Session (`payment_status=paid`) → webhook minted the license → one-time claim returned the key → `/license/activate` minted a Pro entitlement with the correct production kid (`7nwkI8…`), tier pro, quota 1000 → subscription canceled immediately → **$5.00 refund succeeded** → test seat deactivated. Stripe account activation confirmed complete (products activated). Live billing is fully operational.

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

> ⚠️ **Published ID differs from the pinned ID (2026-08-23).** The store published Optia v1.1.0 under **`gnlidlpidaoalbbmekofjednjkhhmehn`**, not the manifest-key-pinned `lgkgkmjldppeidgafolhfpepmabnnbhe` (which still applies to local unpacked loads). Exactly the contingency Phase 4 warned about. Backend `ALLOWED_ORIGINS` now carries **both** IDs (hotfixed + deployed to production 2026-08-23, CORS verified for both). All public listing links must use the new ID: https://chromewebstore.google.com/detail/gnlidlpidaoalbbmekofjednjkhhmehn — links using the old ID 404. Worth investigating later why the store did not honor the manifest `key` (was the `key` field present in the uploaded zip?).

## Phase 5 — Post-publish

- [ ] Install from the store on a clean Chrome profile; re-run the Phase 1 manual QA sweep against production (free AI, checkout with a live card + refund, activation, BYOK).
- [ ] Confirm no CORS errors from the store-installed extension (proves the `ALLOWED_ORIGINS` entry).
- [ ] Fill the `[Chrome Web Store link]` placeholders in `docs/launch-social-posts.md` and post.
- [ ] Watch the first reviews/support requests; the dashboard's user-feedback tab and Stripe's dashboard are the two inboxes that matter in week one.
- [ ] Ongoing: every future upload's `manifest.json` version must be greater than the published one — versions only move via the Release PR.

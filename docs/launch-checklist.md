# Chrome Web Store Launch Checklist

The end-to-end path from this repo to a live, working, paid product. Backend steps reference `optia-backend/docs/PROVISIONING.md` (the go-live runbook). Work top to bottom; phases 1–3 can proceed in parallel, phase 4 depends on all of them.

**Key fact:** the manifest's `key` field pins the extension ID to **`lgkgkmjldppeidgafolhfpepmabnnbhe`** for local loads *and* the store (the key ships in the upload zip). That means the backend's CORS allowlist can be configured **before** submission — there is no wait-for-the-store-ID step.

## Phase 0 — Decisions (block everything else)

- [ ] **Host permissions**: keep `<all_urls>` (any-site analysis, in-depth CWS review accepted) or narrow to `activeTab` + `scripting` (faster review, but changes UX — content script must be injected on demand). Current decision: **keep `<all_urls>`**; record any change here and in the listing's permission justifications.
- [ ] **Privacy contact + hosting**: pick the support/privacy email and where `docs/privacy-policy.md` will be publicly hosted (GitHub Pages or product site). Fill the TODOs in `docs/privacy-policy.md`, `docs/chrome-web-store-listing.md`.
- [ ] **Website URL** for the listing (product site or repo issues page).
- [ ] **Legal review** of `docs/privacy-policy.md` (drafted with the `legal-advisor` agent; flagged TODOs inside).

## Phase 1 — Extension readiness

- [ ] Merge PR #28 (BYOK toggle + invalid-key fallback — closes #12).
- [ ] CI fully green on `main`, including the new **Extension E2E (MV3)** job (`app/e2e/` — MV3 compliance + loaded-extension smoke tests).
- [ ] **Substitute production Stripe price IDs** in `app/src/lib/plans.ts` — the literals `__OPTIA_LIVE_PRICE_PRO_MONTHLY__` / `__OPTIA_LIVE_PRICE_PRO_ANNUAL__` must be replaced before the release build. Candidates already configured in `optia-backend/wrangler.toml` production env: `price_1TucPnDUOj5YQWOd7NknzAmH` (monthly $5), `price_1TucPpDUOj5YQWOdJn47sbJz` (annual $50) — confirm against the live Stripe dashboard, then also confirm the `amountLabel`s match.
- [ ] **Bundle the production entitlement public key**: the extension verifies entitlements against the environment's signing key — confirm `ENTITLEMENT_JWKS` in `app/src/lib/entitlement-keys.ts` contains the **production** key (`GET https://api.optia-api.com/license/public-key`) for production builds, not staging's.
- [ ] Confirm `BACKEND_BASE_URL` resolves to `https://api.optia-api.com` in the production build (Vite mode), never staging/localhost.
- [ ] Manual QA sweep of the built extension (load `app/dist` unpacked): free analysis, free AI (quota ticks down), paywall → Stripe test checkout, license activation, Pro features, BYOK path, options page.

## Phase 2 — Backend go-live (`optia-backend`)

Follow `docs/PROVISIONING.md` §1–§8 for the production environment:

- [ ] D1 `optia-db-production` created + migrations applied (`pnpm db:migrate:production`).
- [ ] KV `RATE_LIMIT` bound; production secrets set (Anthropic key, Stripe live secret + webhook secret, signing private key).
- [ ] **CORS**: replace `chrome-extension://__OPTIA_EXTENSION_ID__` with `chrome-extension://lgkgkmjldppeidgafolhfpepmabnnbhe` in `wrangler.toml` `ALLOWED_ORIGINS` (all three envs reference it; production matters for launch) — can be done now thanks to the pinned ID.
- [ ] Stripe live-mode webhook endpoint pointed at `api.optia-api.com` and verified.
- [ ] Deploy production with a real `COMMIT_SHA` (`pnpm deploy:production` per the runbook — the `"UNSET"` sentinel in `/health` means the override was forgotten).
- [ ] Smoke: `/health`, `/license/public-key`, one metered `POST /ai/generate` from a production build, one full checkout → activation with a live card (then refund).

## Phase 3 — Store package, listing, legal

- [ ] Cut the release: merge the Release Please PR (see `docs/RELEASING.md`) → tag → `optia-X.Y.Z.zip` attached to the GitHub Release by the Release Zip workflow.
- [ ] Render store assets (`marketing/store-assets/README.md`): ≥1 screenshot at 1280×800 (aim for 4–5), small promo tile 440×280.
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

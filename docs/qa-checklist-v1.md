# Manual QA Checklist — v1.0.0

The human half of issue #16. The automated half lives in `app/src/**/*.test.*` (500+ unit/component tests) and `app/e2e/` (26 Playwright tests: MV3 compliance, extension smoke, freemium/error paths with a mocked backend). This checklist covers what automation can't: the real staging backend, real Stripe test checkout, signed entitlements, timing, and look-and-feel.

**Setup:** fresh Chrome profile (`chrome://extensions` → Developer mode → Load unpacked → `app/dist`). Build with `pnpm build` for production (live backend) or a staging build for checkout testing with Stripe test cards. Keep four consoles open throughout: side panel (inspect view), options page, service worker (chrome://extensions → "service worker"), and a content-script page console. **Any console error during these flows is a finding.** Run the full pass twice: once in light, once in dark theme.

## 1. First run & free tier
- [ ] Onboarding modal appears once; "Get Started" dismisses it; it stays dismissed after panel reopen
- [ ] Analyze a real content page (e.g. a blog article) — score renders, categories populate, priority labels sensible
- [ ] "New Analysis" resets; re-analyze a second site works
- [ ] Generate an AI recommendation (title) — arrives, is relevant, one-click copy works
- [ ] Free quota counts down in options ("Free AI quota this month: N of 25")
- [ ] Highlight-issues on page works and clears

## 2. Over-quota → paywall
- [ ] Exhaust the free quota (or seed `free_ai_quota` remaining:0 via the SW console) — AI buttons disable with upsell copy
- [ ] Paywall opens from the quota path with the "used all 25" banner and reset date
- [ ] Paywall from the header Upgrade button shows plans $5/mo, $50/yr + "2 months free"

## 3. Upgrade (staging + Stripe test card 4242 4242 4242 4242)
- [ ] "Continue to checkout" opens Stripe in a new tab; panel shows "Waiting for payment confirmation…"
- [ ] Complete payment → success page shows "Payment complete" + payment reference
- [ ] Panel flips to Pro automatically (no manual key entry); paywall shows "You're on Pro"
- [ ] Close the panel mid-payment, reopen — claim resumes and still activates
- [ ] Cancel checkout on Stripe → cancel page renders; panel Cancel button exits polling cleanly

## 4. Pro features
- [ ] Pro pill in options License card; quota shows N of 1,000; renew date sensible
- [ ] Advanced Analysis toggle enabled; page-type + secondary keywords affect recommendations
- [ ] Multi-language: set a non-English default → AI output in that language
- [ ] Schema recommendations available
- [ ] BYOK: add an Anthropic key + toggle on → generation works, quota does NOT tick; License card shows "using your Anthropic key — not metered"
- [ ] BYOK invalid key: garbage key → one clear toast, automatic fallback to hosted, inline warning near the key field
- [ ] Manual activation path: deactivate, then re-activate by pasting the license key in options

## 5. Billing management & downgrade
- [ ] "Manage billing" opens the Stripe portal; return lands on the account page
- [ ] Cancel the subscription in the portal → after entitlement refresh (or deactivate/reactivate), extension degrades to Free cleanly: Pro features gated again, no crashes, stored BYO key inert
- [ ] "Deactivate on this browser" returns to Free immediately

## 6. Resilience spot-checks
- [ ] Offline (DevTools → Network → Offline): analysis still works (local); AI + checkout fail with friendly messages, recover when back online
- [ ] Kill the service worker (chrome://serviceworker-internals or wait for idle) mid-session → panel actions still work (SW restarts)
- [ ] Restart Chrome → entitlement, key, settings, and quota display all persist

## 7. Both themes & polish
- [ ] Repeat a skim of every surface in dark mode: panel (all pages), options, paywall, onboarding — no unreadable text or broken layouts
- [ ] Window-width extremes: panel at ~360px and ~500px

## Sign-off
- [ ] Zero console errors recorded across all four consoles during the pass
- [ ] Findings filed as issues (label `bug`, milestone v1.0.0); P0/P1 fixed before release
- [ ] When green: land a commit with a `Release-As: 1.0.0` footer → merge the Release PR (stamps `manifest.json` 1.0.0, attaches `optia-1.0.0.zip`) → release notes from `docs/release-notes-v1.0.0.md`

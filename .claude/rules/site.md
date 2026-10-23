---
paths:
  - "site/**"
  - "scripts/build-docs-site.mjs"
---

# The site (`site/`)

Static HTML published verbatim to GitHub Pages at https://pmdevsolutions.github.io/Optia/ by `.github/workflows/pages.yml` on every push to `main` that touches `site/**` (environment `github-pages`; `workflow_dispatch` as well). No build step, no framework, no external scripts; inline CSS with a light and dark scheme via `prefers-color-scheme`.

- `index.html`: the landing page. Its CTA is the store listing `https://chromewebstore.google.com/detail/optia/gnlidlpidaoalbbmekofjednjkhhmehn` with `utm_source=github`, `utm_medium=referral`, `utm_campaign=optia`, `utm_content=site`. Keep the UTM scheme; Maecenas reports on it.
- `privacy.html`: the privacy policy the Chrome Web Store listing and the Stripe business profile link to. `docs/privacy-policy.md` is its Markdown mirror; change both in the same PR, and `docs/chrome-web-store-data-disclosure.md` when a data flow changes.
- `account.html`, `billing-success.html`, `billing-cancel.html`: the pages Stripe Checkout and the Billing Portal return to, configured in the private backend. Their URLs do not change without a matching backend change.
- `docs/`: generated. Edit the `PAGES` data or the template in `scripts/build-docs-site.mjs`, re-run `node scripts/build-docs-site.mjs`, commit the output. Slugs are load-bearing: `app/src/lib/docs-links.ts` maps every check id to `docs/<category>/<slug>.html` and `app/src/lib/seo-analyzer.test.ts` fails when a linked page is missing.
- Published URLs are referenced by the store listing (homepage `https://pmds.info/products/optia`, privacy on this site), the Stripe profile and the extension. Keep them stable; add a redirect page rather than removing one.
- Copy follows `brand-guidelines.json`: product voice addressing "you", plainspoken, honest, practical; only the real numbers (25 free AI recommendations a month, 1,000 on Pro, $5/month or $50/year, Claude by Anthropic).
- Check a change with the Playwright MCP server (`mcp__playwright__browser_navigate` on the file URL or the Pages URL) at 390 and 1280 pixels wide, light and dark, before opening the PR. After a merge, `gh run list --workflow "Deploy Site" --limit 1` shows the deploy.

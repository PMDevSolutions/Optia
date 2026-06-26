# /release-extension

Cut a Chrome Web Store release of Optia the one correct way. Bumps the version, keeps `manifest.json` in sync, builds, produces an uploadable zip, and prints the store-dashboard checklist.

## Usage

```
/release-extension            # then choose patch | minor | major
```

## ⚠️ Step 0 — Run from `app/`, never the repo root

```bash
cd app
```

Releases MUST run from `app/`. `app/.versionrc.json` bumps **both** `package.json` and `manifest.json` and tags `app-v*`. The repo root has **no** release config (by design) — running `standard-version` from root would tag nothing useful and leave `manifest.json` stale, which the Chrome Web Store rejects. (A PreToolUse hook blocks root releases.)

## Steps

1. **Pre-flight** — clean tree on `main`, everything green:
   ```bash
   git switch main && git pull
   cd app && pnpm install --frozen-lockfile
   pnpm lint && pnpm tsc --noEmit && pnpm test
   ```
2. **Dry-run** the version bump to preview the changelog/version:
   ```bash
   pnpm release:dry
   ```
3. **Release** (pick one) — bumps `package.json` + `manifest.json`, updates `CHANGELOG.md`, creates the `app-v<version>` tag:
   ```bash
   pnpm release:patch   # or release:minor / release:major
   ```
4. **Verify version sync** — `manifest.json` version === `package.json` version === the new git tag. Do not proceed if they differ.
5. **Build, then package** the store zip — `manifest.json` MUST sit at the archive ROOT (zip the *contents* of `app/dist`, not the folder), excluding Vite metadata:
   ```bash
   pnpm build
   # macOS/Linux:
   ( cd dist && zip -r "../optia-v$(node -p "require('./manifest.json').version").zip" . -x ".vite/*" )
   ```
   On Windows (PowerShell), compress the contents of `app/dist` with any archiver, keeping `manifest.json` at the root and excluding `.vite/`. Before uploading, re-confirm `manifest.json` version === `package.json` version.
6. **Upload** the zip in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Paste-ready answers (sourced from `app/PRIVACY_POLICY.md` and `docs/chrome-web-store-listing.md`):
   - **Single purpose:** "Analyze the current page's on-page SEO and provide AI-assisted recommendations to improve it."
   - **Permission justifications:**
     - `tabs` — read the active tab's URL/title to analyze the page the user is viewing.
     - `sidePanel` — render the analysis UI in Chrome's side panel.
     - `storage` — store the user's OpenAI API key, language preference, and per-tab results locally.
     - `scripting` — read the current page's DOM (meta tags, headings, images, links) for analysis.
     - `host_permissions <all_urls>` — the user can analyze any page they choose; the extension only reads a page when the user clicks Analyze. (Note: `<all_urls>` + `scripting` + `tabs` is the heightened-review bucket — expect a longer review.)
   - **Data usage:** No analytics/tracking. Page content is sent to OpenAI **only** on user-initiated AI requests, using the user's **own** API key, directly browser→OpenAI. Nothing is sent to any first-party server.
   - **Remote code:** No.
7. **Post-release reminders:**
   - Refresh `store-screenshots/` if the UI changed (the redesign did).
   - Backfill the `[Chrome Web Store link]` placeholders in `docs/launch-social-posts.md`.
   - Push the tag: `git push --follow-tags`.

## Reminder

Adding or removing a manifest permission/host_permission **disables the extension for existing users** until they manually re-grant, and triggers a fresh review. Treat permission changes as a release event, not a routine code change.

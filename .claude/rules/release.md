---
paths:
  - ".github/workflows/**"
  - "CHANGELOG.md"
  - "release-please-config.json"
  - ".release-please-manifest.json"
  - "docs/RELEASING.md"
---

# Releases and CI

`docs/RELEASING.md` is canonical. release-please (`release-please.yml`, config `release-please-config.json`, state `.release-please-manifest.json`) is the only release mechanism; the `standard-version` scripts were removed on 2026-10-23.

- Conventional Commits on `main` drive the version: `fix:` patch, `feat:` minor, `feat!:` or a `BREAKING CHANGE:` footer major; `docs:`, `chore:`, `test:`, `ci:`, `refactor:` do not bump and stay out of the changelog. Squash-merge PRs with a Conventional Commit title. A `Release-As: x.y.z` footer forces a version.
- release-please keeps one open Release PR from branch `release-please--branches--main--components--optia`. **Merging it is the human release gate.** It stamps `package.json`, `app/package.json` and `app/manifest.json` (the `extra-files`), rewrites `CHANGELOG.md`, tags `vX.Y.Z` and publishes a GitHub Release. The `attach-zip` job in the same run builds `app/dist` at the tag, deletes the manifest `key` (the store rejects it) and uploads `optia-X.Y.Z.zip`. Releases created with the default `GITHUB_TOKEN` do not fire `on: release`, which is why the zip is attached in that run.
- `release-zip.yml` is the manual fallback (`workflow_dispatch` with a tag) to rebuild and re-attach the zip.
- The Chrome Web Store upload is manual: Paul downloads the zip and uploads it in the Developer Dashboard under paul@pmds.info (item `gnlidlpidaoalbbmekofjednjkhhmehn`). The store requires `manifest.json` at the archive root and a version greater than the published one. `/store-upload-check [tag]` verifies the package first.
- `pages.yml` deploys `site/` on a push to `main` touching `site/**`. `ci.yml` runs on every PR and push to `main`: Lint & Format, Type Check, Test, Build, Extension E2E (MV3) under xvfb, and Claude Code conformance & hook tests (`node scripts/claude-code-conformance.js --root . --strict`, `node --test scripts/__tests__/*.test.js`). Branch protection on `main` requires these checks on an up-to-date branch; administrators can bypass in an emergency.
- Workflows pin `actions/checkout@v7`, `pnpm/action-setup@v6` (pnpm 10), `actions/setup-node@v6` (Node 22). Dependabot (`.github/dependabot.yml`) proposes action updates weekly with a `ci` prefix.
- Never hand-edit a version or `CHANGELOG.md`, never `gh release create`, never push a tag. The release guard asks before `git push`, `gh pr merge`, `gh release` writes, `gh workflow run` and `gh run rerun`, and denies them in subagents.

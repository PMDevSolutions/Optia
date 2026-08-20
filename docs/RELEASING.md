# Releasing Optia

Releases are automated with [release-please](https://github.com/googleapis/release-please) driven by Conventional Commits. The old `standard-version` scripts in the root `package.json` are superseded by this flow and kept only for local dry-runs.

## How a release happens

1. Merge work to `main` with Conventional Commit messages (`feat:`, `fix:`, …). The `commit-commands` plugin's `/commit` already produces these.
2. The **Release Please** workflow maintains a single open Release PR that accumulates changes. It bumps the version in `package.json`, `app/package.json`, **and `app/manifest.json`** (the three stay in lockstep — never hand-edit a version), and drafts `CHANGELOG.md`.
3. **Merging the Release PR is the human release gate.** It tags `vX.Y.Z` and publishes a GitHub Release.
4. The **Release Zip** workflow fires on the published release: it builds `app/dist` at the tag and attaches `optia-X.Y.Z.zip` — the exact Chrome Web Store upload package — to the release.
5. Upload that zip in the [CWS Developer Dashboard](https://chrome.google.com/webstore/devconsole) (manual for now; see `docs/launch-checklist.md`). The zip contains `manifest.json` at the archive root, as the dashboard requires.

## Version bumps

| Commit type | Bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` / `BREAKING CHANGE:` footer | major |
| `docs:`, `chore:`, `test:`, `ci:`, `refactor:` | none (hidden from changelog) |

To force a specific version, add a `Release-As: 1.0.0` footer to any commit on `main`.

## Cautions

- **Squash-merge PRs with a Conventional Commit title** — release-please reads the commits that land on `main`, and a squash commit's message is the PR title.
- The manifest `key` field pins the extension ID (`lgkgkmjldppeidgafolhfpepmabnnbhe`); it ships in the zip so the store keeps the same ID across uploads. Do not remove or regenerate it.
- The Chrome Web Store requires each upload's `manifest.json` version to be **greater** than the currently published one — another reason versions only move through the Release PR.

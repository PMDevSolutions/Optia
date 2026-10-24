# Releasing Optia

Releases are automated with [release-please](https://github.com/googleapis/release-please) driven by Conventional Commits. There is no other release mechanism: the `standard-version` scripts were removed on 2026-10-23.

## How a release happens

1. Merge work to `main` with Conventional Commit messages (`feat:`, `fix:`, …), written as `type(scope): summary`.
2. The **Release Please** workflow maintains a single open Release PR that accumulates changes. It bumps the version in `package.json`, `app/package.json`, **and `app/manifest.json`** (the three stay in lockstep — never hand-edit a version), and drafts `CHANGELOG.md`.
3. **Merging the Release PR is the human release gate.** It tags `vX.Y.Z` and publishes a GitHub Release.
4. The `attach-zip` job in the same **Release Please** run builds `app/dist` at the new tag, strips the manifest `key`, and attaches `optia-X.Y.Z.zip` — the exact Chrome Web Store upload package — to the release. (Releases created with the default `GITHUB_TOKEN` do not trigger `on: release` workflows, so the zip is built there.) **Release Zip** (`release-zip.yml`) is the manual `workflow_dispatch` fallback to rebuild and re-attach the zip at a tag.
5. Upload that zip in the [CWS Developer Dashboard](https://chrome.google.com/webstore/devconsole) (manual for now; see `docs/launch-checklist.md`). The zip contains `manifest.json` at the archive root, as the dashboard requires.

## Version bumps

| Commit type | Bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` / `BREAKING CHANGE:` footer | major |
| `docs:`, `chore:`, `test:`, `ci:`, `refactor:` | none (hidden from changelog) |

To force a specific version, add a `Release-As: 1.0.0` footer to any commit on `main`. Footers on branch commits do not survive a squash merge (the squash body is blank), so type the footer into the squash commit when merging: `gh pr merge <n> --squash --body 'Release-As: 1.0.0'`, or edit the message in the merge dialog. The same goes for a `BREAKING CHANGE:` footer; `feat!:` in the PR title needs nothing extra.

## Cautions

- **Squash-merge PRs with a Conventional Commit title** — release-please reads the commits that land on `main`, and a squash commit's message is the PR title. Since 2026-10-24 the repository allows only squash merges, with the PR title as the commit title and a blank body: release-please splits any body paragraph that starts with a type such as `feat(` into a second changelog entry, which is how 1.1.3 and 1.2.0 listed each change twice from their merge commits.
- The manifest `key` field pins the extension ID (`lgkgkmjldppeidgafolhfpepmabnnbhe`); it ships in the zip so the store keeps the same ID across uploads. Do not remove or regenerate it.
- The Chrome Web Store requires each upload's `manifest.json` version to be **greater** than the currently published one — another reason versions only move through the Release PR.

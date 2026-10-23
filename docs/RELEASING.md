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

To force a specific version, add a `Release-As: 1.0.0` footer to any commit on `main`.

## Cautions

- **Squash-merge PRs with a Conventional Commit title** — release-please reads the commits that land on `main`, and a squash commit's message is the PR title.
- The manifest `key` field pins the extension ID (`lgkgkmjldppeidgafolhfpepmabnnbhe`); it ships in the zip so the store keeps the same ID across uploads. Do not remove or regenerate it.
- The Chrome Web Store requires each upload's `manifest.json` version to be **greater** than the currently published one — another reason versions only move through the Release PR.

## Branch protection

`main` is protected so that every pull request, the Release PR included, must be up to date and pass the six CI jobs before it merges; administrators keep bypass for emergencies. Apply or re-apply it with:

```bash
gh api -X PUT repos/PMDevSolutions/Optia/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Lint & Format" },
      { "context": "Type Check" },
      { "context": "Test" },
      { "context": "Build" },
      { "context": "Extension E2E (MV3)" },
      { "context": "Claude Code conformance & hook tests" }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

Check it with `gh api repos/PMDevSolutions/Optia/branches/main/protection --jq '[.required_status_checks.checks[].context]'`. When a CI job is renamed, update the list here and in the protection rule in the same PR.

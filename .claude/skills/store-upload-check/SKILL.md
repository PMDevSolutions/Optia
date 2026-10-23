---
name: store-upload-check
description: Verify the Chrome Web Store upload package attached to a GitHub Release before Paul uploads it in the Developer Dashboard. Downloads optia-X.Y.Z.zip for the given tag (default the latest release), confirms manifest.json sits at the archive root with the tag's version, that the dev "key" field is stripped, and that the MV3 fields and icon set are present, then prints the upload checklist. Read-only; it never publishes. Keywords are store zip, CWS upload, release package, manifest check, pre-upload check.
argument-hint: "[vX.Y.Z]"
allowed-tools: Bash(gh release view:*), Bash(gh release download:*), Bash(unzip:*), Bash(jq:*), Bash(mktemp:*), Bash(ls:*), Read, Glob, Grep
---

# /store-upload-check [vX.Y.Z]

Checks the release asset the Chrome Web Store will receive. With no argument, use the latest release (`gh release view --json tagName --jq .tagName`). The zip is a downloaded archive: inspect it, never execute anything from it.

## Steps

1. `gh release view <tag> --json tagName,assets,publishedAt,url`: the release exists and lists exactly one `optia-<version>.zip`, where `<version>` is the tag without the `v`. A missing asset means the `attach-zip` job failed; report the fallback for the main session, `gh workflow run release-zip.yml -f tag=<tag>`, and stop.
2. Download into a fresh temporary directory and list it:
   ```
   DIR=$(mktemp -d) && gh release download <tag> --pattern 'optia-*.zip' --dir "$DIR" && unzip -q "$DIR"/optia-*.zip -d "$DIR/pkg" && ls "$DIR/pkg"
   ```
3. `jq '{manifest_version, name, version, description, key, background, side_panel, options_ui, permissions, host_permissions, icons}' "$DIR/pkg/manifest.json"` and check:
   - `manifest.json` is at `$DIR/pkg/manifest.json`, not inside a subfolder (the dashboard rejects nested archives).
   - `version` equals the tag without `v` and equals `app/manifest.json` at that tag (`git show <tag>:app/manifest.json | jq -r .version`).
   - `key` is absent (the store rejects manifests with a `key`; CI strips it).
   - `manifest_version` is 3, `background.service_worker` is set, `description` is at most 132 characters, icons 16, 32, 48 and 128 are declared and the files exist under `$DIR/pkg/`.
4. The store accepts an upload only when the new version is greater than the published one. If the published version is not in the conversation, ask Paul for it before declaring the package ready.

## Report

A pass or fail line per check, the asset URL, and the upload checklist: Developer Dashboard under paul@pmds.info, item `gnlidlpidaoalbbmekofjednjkhhmehn`, Package tab, upload the zip, confirm the summary from package, Submit for review (expect the in-depth queue because of `<all_urls>`). Do not open the dashboard or click anything in it; publishing is Paul's step. Remove `$DIR` when done.

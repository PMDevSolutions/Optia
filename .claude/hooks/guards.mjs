#!/usr/bin/env node
/**
 * Optia extension guardrails. Reads the Claude Code hook payload (JSON on stdin)
 * and emits high-signal, deterministic reminders. Cross-platform (Node only).
 *
 * Wired in .claude/settings.json:
 *   - PreToolUse  / Bash        -> block running standard-version|release from repo root
 *   - PostToolUse / Write|Edit  -> remind on extractor-twin and manifest edits
 */
import { readFileSync } from "node:fs";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // never break the tool on a parse hiccup
}

const event = payload.hook_event_name || "";
const tool = payload.tool_name || "";
const input = payload.tool_input || {};
const file = String(input.file_path || "").replace(/\\/g, "/");
const cmd = String(input.command || "");
const note = (m) => console.log("[optia-guard] " + m);

// --- PreToolUse: block a release run from the repo root -------------------
if (event === "PreToolUse" && tool === "Bash") {
  const isRelease = /(^|\s)(standard-version\b|pnpm\s+run\s+release|pnpm\s+release(:[a-z]+)?\b)/.test(cmd);
  const scopedToApp = /(^|\s|&&|;)\s*cd\s+app\b/.test(cmd) || /(^|\s)app\//.test(cmd);
  if (isRelease && !scopedToApp) {
    console.error(
      "Run releases from app/ — e.g. `cd app && pnpm release:patch`.\n" +
      "The repo root has no release config; only app/.versionrc.json bumps BOTH " +
      "package.json and manifest.json (tag app-v*). A stale manifest.json version is " +
      "rejected by the Chrome Web Store. Use /release-extension."
    );
    process.exit(2); // block
  }
}

// --- PostToolUse: file-edit reminders -------------------------------------
if (event === "PostToolUse" && (tool === "Write" || tool === "Edit" || tool === "MultiEdit")) {
  if (/(^|\/)(content\/analyzer|lib\/extract-page-data-inline)\.ts$/.test(file)) {
    note(
      "Edited a page extractor — keep the TWIN in sync: content/analyzer.ts " +
      "(extractPageSEOData) <-> lib/extract-page-data-inline.ts (extractPageDataInline). " +
      "Both must return the same PageSEOData; the inline one must stay import-free. Then: cd app && pnpm test"
    );
  }
  if (/(^|\/)manifest\.json$/.test(file)) {
    note(
      "Edited manifest.json — keep \"version\" equal to package.json (release from app/ only). " +
      "Adding/removing a permission or host_permission DISABLES the extension for existing users " +
      "until they re-grant AND triggers a fresh Chrome Web Store review — not a routine code change."
    );
  }
}

process.exit(0);

// Tests for the hooks in .claude/hooks/. Run with: node --test scripts/__tests__/*.test.js
//
// Contract (https://code.claude.com/docs/en/hooks): Claude Code passes the event as
// JSON on stdin; a hook replies with JSON on stdout (SessionStart may reply with plain
// text) and ALWAYS exits 0. These tests feed synthetic events and parse the reply.
// node:test ships with Node, so no test framework is installed at the repo root.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const HOOKS_DIR = join(repoRoot, ".claude", "hooks");

function runHook(name, event, { cwd = repoRoot, env = {}, args = [] } = {}) {
  // execFileSync throws on a non-zero exit, so reaching the assertion proves exit 0.
  return execFileSync("bash", [join(HOOKS_DIR, name), ...args], {
    cwd,
    encoding: "utf8",
    input: typeof event === "string" ? event : JSON.stringify(event),
    // The session hook skips its gh calls unless a test opts in, so the suite is offline.
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd, OPTIA_SESSION_CONTEXT_GH: "0", ...env },
  });
}
const parse = (out) => (out.trim() ? JSON.parse(out) : null);
const bash = (command, extra = {}) => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, ...extra });
const guard = (cmd, extra = {}, args = []) => parse(runHook("release-guard.sh", bash(cmd, extra), { args }))?.hookSpecificOutput;

const HOOKS = ["release-guard.sh", "session-context.sh"];

describe("hook contract", () => {
  for (const hook of HOOKS) {
    test(`${hook} exits 0 and stays quiet or returns JSON on an unrelated event`, () => {
      const out = runHook(hook, bash("ls -la"));
      if (out.trim() && hook !== "session-context.sh") assert.doesNotThrow(() => JSON.parse(out));
    });
    test(`${hook} exits 0 on empty stdin`, () => {
      assert.equal(typeof runHook(hook, ""), "string");
    });
    test(`${hook} exits 0 on malformed JSON`, () => {
      assert.equal(typeof runHook(hook, "{not json"), "string");
    });
  }
});

describe("release-guard (PreToolUse, Bash)", () => {
  // The three cases named in the acceptance criteria of issue #77 come first.
  const ASKS = {
    "git push origin main": /git push/,
    "gh pr merge 123": /merging a pull request/,
    "gh release create v1.2.0": /gh release writes/,
    "git push": /no branch is named/,
    "git push origin HEAD:main": /targets main/,
    "git push origin HEAD": /targets HEAD/,
    "git -C /tmp/x push": /no branch is named/,
    "git --no-pager push origin main": /targets main/,
    "cd app && git push": /no branch is named/,
    "git push --force origin fix/x": /--force forces/,
    "git push origin --delete feat/old": /--delete forces/,
    "git push origin :feat/old": /empty source deletes/,
    "git push --tags": /--tags forces/,
    "git push origin v1.2.0": /targets v1\.2\.0/,
    "git push origin +fix/x": /force-updates/,
    "git push origin refs/heads/main": /targets refs\/heads\/main/,
    "git push -u origin chore/x && git push origin main": /targets main/,
    "gh pr merge 82 --squash --subject 'chore(main): release 1.2.0'": /merging a pull request/,
    "gh api -X PUT repos/PMDevSolutions/Optia/pulls/82/merge": /merging a pull request/,
    "gh release edit v1.1.3 --notes 'x'": /gh release writes/,
    "gh release upload v1.1.3 app/optia-1.1.3.zip --clobber": /gh release writes/,
    "gh release delete v1.1.3 --yes": /gh release writes/,
    "gh release delete-asset v1.1.3 optia-1.1.3.zip": /gh release writes/,
    "gh api repos/PMDevSolutions/Optia/releases -f tag_name=v1.2.0": /gh release writes/,
    "gh api -X DELETE repos/PMDevSolutions/Optia/releases/1": /gh release writes/,
    "gh workflow run release-zip.yml -f tag=v1.1.3": /gh workflow run/,
    "gh workflow run pages.yml": /gh workflow run/,
    "gh api repos/PMDevSolutions/Optia/actions/workflows/pages.yml/dispatches -f ref=main": /gh workflow run|dispatch/,
    "gh run rerun 123456789": /re-running a workflow/,
  };
  for (const [cmd, reason] of Object.entries(ASKS)) {
    test(`asks on: ${cmd}`, () => {
      const res = guard(cmd);
      assert.ok(res, "expected a decision");
      assert.equal(res.hookEventName, "PreToolUse");
      assert.equal(res.permissionDecision, "ask");
      assert.match(res.permissionDecisionReason, reason);
      assert.match(res.permissionDecisionReason, /this prompt is the gate/);
    });
  }

  test("denies inside a subagent (agent_id present in the event)", () => {
    for (const cmd of ["git push origin main", "gh pr merge 123", "gh release create v1.2.0"]) {
      const res = guard(cmd, { agent_id: "a1b2", agent_type: "release-manager" });
      assert.equal(res.permissionDecision, "deny", cmd);
      assert.match(res.permissionDecisionReason, /Subagents never push to main, merge, release/);
    }
  });

  test("denies when only agent_type is present", () => {
    const res = guard("git push origin main", { agent_type: "extension-developer" });
    assert.equal(res.permissionDecision, "deny");
  });

  test("denies with --deny regardless of context", () => {
    const res = guard("gh workflow run release-zip.yml -f tag=v1.1.3", {}, ["--deny"]);
    assert.equal(res.permissionDecision, "deny");
  });

  test("asks in bypassPermissions and dontAsk too (Claude Code decides what ask means there)", () => {
    for (const permission_mode of ["bypassPermissions", "dontAsk"]) {
      const res = guard("git push origin main", { permission_mode });
      assert.equal(res.permissionDecision, "ask", permission_mode);
    }
  });

  const SILENT = [
    "pnpm -C app test",
    "pnpm -C app build",
    "pnpm -C app lint",
    "pnpm -C app test:e2e",
    "pnpm -C app tsc --noEmit",
    "git status",
    "git log --oneline -5",
    "git diff main",
    'git commit -m "fix: push fix for the badge"',
    "git -c core.pager=cat log --grep push",
    "git push -u origin chore/claude-code-conformance",
    "git push --force-with-lease origin fix/x",
    "git push -u origin chore/x && gh pr create --fill",
    "git push origin feature/one feature/two",
    "git push --dry-run -u origin chore/x",
    "git fetch origin && git pull --rebase",
    "git checkout -b chore/x origin/main",
    "gh pr view 12",
    "gh pr list --state open",
    "gh pr create --title x --body y",
    "gh pr checks 12",
    "gh release view v1.1.3 --json assets",
    "gh release list --limit 5",
    "gh release download v1.1.3 --pattern 'optia-*.zip' --dir /tmp/x",
    "gh api repos/PMDevSolutions/Optia/releases/latest",
    "gh api repos/PMDevSolutions/Optia/releases --jq '.[0].tag_name'",
    "gh run list --workflow CI --branch main --limit 5",
    "gh run view 1 --log-failed",
    "gh workflow list",
    "gh issue list",
    "node scripts/claude-code-conformance.js --root . --strict",
    "node --test scripts/__tests__/*.test.js",
    "node scripts/build-docs-site.mjs",
    "jq .version app/manifest.json",
  ];
  for (const cmd of SILENT) {
    test(`stays silent on: ${cmd}`, () => {
      assert.equal(runHook("release-guard.sh", bash(cmd)), "");
    });
  }

  test("stays silent on non-Bash tools", () => {
    assert.equal(runHook("release-guard.sh", { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "x.md" } }), "");
  });
});

describe("session-context (SessionStart)", () => {
  const start = { hook_event_name: "SessionStart", source: "startup" };

  test("prints the branch, the version lockstep and the release notes without gh", () => {
    const out = runHook("session-context.sh", start);
    assert.match(out, /^Optia session context/m);
    assert.match(out, /- Branch: /);
    assert.match(out, /- Uncommitted changes: \d+ file\(s\)/);
    assert.match(out, /- Versions: app\/manifest\.json \d+\.\d+\.\d+, app\/package\.json \d+\.\d+\.\d+, package\.json \d+\.\d+\.\d+, \.release-please-manifest\.json \d+\.\d+\.\d+: in lockstep/);
    assert.match(out, /- Latest GitHub Release: unavailable/);
    assert.match(out, /- Open Release PR: unavailable/);
    assert.match(out, /- Open issues: unavailable/);
    assert.match(out, /release guard asks before a push to main/);
  });

  test("reads the Release PR, latest release, CI, Pages and issues from gh", () => {
    // A fake gh on PATH answers each query with fixed JSON, so the test is offline and deterministic.
    const tmp = mkdtempSync(join(tmpdir(), "optia-gh-"));
    try {
      const gh = join(tmp, "gh");
      writeFileSync(gh, `#!/usr/bin/env bash
case "$*" in
  "pr list"*) echo '[{"number":82,"title":"chore(main): release 1.2.0","url":"https://github.com/PMDevSolutions/Optia/pull/82"}]' ;;
  "release view"*) echo '{"tagName":"v1.1.3","publishedAt":"2026-09-29T20:16:33Z"}' ;;
  "run list --workflow CI"*) echo '[{"conclusion":"success","status":"completed","createdAt":"2026-10-23T16:27:28Z"}]' ;;
  "run list --workflow Deploy Site"*) echo '[{"conclusion":"failure","status":"completed","createdAt":"2026-10-02T14:40:52Z"}]' ;;
  "issue list"*) echo '[{"number":77},{"number":79},{"number":80}]' ;;
  *) exit 1 ;;
esac
`);
      chmodSync(gh, 0o755);
      const out = runHook("session-context.sh", start, { env: { OPTIA_SESSION_CONTEXT_GH: "1", PATH: `${tmp}:${process.env.PATH}` } });
      assert.match(out, /- Open Release PR: #82 chore\(main\): release 1\.2\.0 \(https:\/\/github\.com\/PMDevSolutions\/Optia\/pull\/82\)/);
      assert.match(out, /- Latest GitHub Release: v1\.1\.3 \(2026-09-29\)(;| and)/);
      assert.match(out, /- Last CI on main: success \(2026-10-23\)\. Last Deploy Site run: failure \(2026-10-02\)/);
      assert.match(out, /- Open issues: 3/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("survives an empty project with no manifests", () => {
    const tmp = mkdtempSync(join(tmpdir(), "optia-ctx-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: tmp });
      const out = runHook("session-context.sh", start, { cwd: tmp });
      assert.match(out, /^Optia session context/m);
      assert.match(out, /app\/manifest\.json missing/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

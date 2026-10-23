---
paths:
  - ".claude/**"
  - "scripts/claude-code-conformance.js"
  - "scripts/lib/claude-code-spec.json"
  - "scripts/__tests__/**"
---

# Claude Code conventions for this repo (verified against Claude Code 2.1.288, 2026-10-03; applied here 2026-10-23)

Run `node scripts/claude-code-conformance.js --root . --strict` and `node --test scripts/__tests__/*.test.js` after editing anything under `.claude/`. CI runs both in the `conformance` job of `ci.yml`. The checker fails on retired tool names, unknown frontmatter fields, legacy command files, hooks that reference missing scripts or the old environment-variable contract, and docs that name retired tools.

## Agents (`.claude/agents/<name>.md`)
- Required: `name` (matches the filename), `description` (when to delegate, with keywords). Used here: `tools`, `color`, `hooks`.
- Tool names that exist: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `WebSearch`, `WebFetch`, `Skill`, `Agent`, `NotebookEdit`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`, `ToolSearch`, plus MCP patterns such as `mcp__playwright__browser_*`.
- Retired, never use: `MultiEdit` (use `Edit`), `Task` (use `Agent`), `TaskOutput`, `BashOutput`, `KillShell` (use `TaskStop`), `SlashCommand` (use `Skill`), `Edits`. `TodoWrite` is not offered on current models: track progress in a file.
- `AskUserQuestion` is never available inside a subagent. Agents return open questions in their final report.
- A `tools:` list excludes MCP tools unless an `mcp__<server>__*` pattern is listed. Agents that drive a browser list `mcp__playwright__browser_*`.
- `color` accepts only red, blue, green, yellow, purple, orange, pink, cyan.
- No agent uses `permissionMode: bypassPermissions`. Every agent that keeps `Bash` carries the `release-guard.sh` PreToolUse hook in its frontmatter, which denies pushes, merges, releases and workflow dispatches inside a subagent.
- The roster is six agents for what this repo does (extension, tests, site, backend contract, store listing, releases). Marketing lanes run from the Maecenas repo; do not copy its agents back in.

## Skills (`.claude/skills/<name>/SKILL.md`)
- Fields used: `name`, `description` (with trigger keywords), `argument-hint`, `allowed-tools` (pre-approval, not restriction). Add `disable-model-invocation: true` to any skill that would cut a release or publish; none does today.
- `globs:` is not a field. Path scoping is `paths:`. Keep `SKILL.md` under 500 lines.

## Hooks (`.claude/hooks/*.sh`, registered in `.claude/settings.json`)
- Input is the event JSON on stdin; output is JSON on stdout (SessionStart may print plain text). `$TOOL_INPUT` and `$TOOL_OUTPUT` are not part of the contract. Source `lib/hook-io.sh` and call `hook_read_input`.
- Every hook keeps the defensive skeleton (`set -u`, `trap 'exit 0' ERR`, always exit 0) and has tests in `scripts/__tests__/hooks.test.js`.
- Blocking decisions are `permissionDecision: deny` or `ask` from a PreToolUse hook. Reminders are `additionalContext`.
- Reference scripts as `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/<name>.sh` (quoted; works from worktrees). Hook scripts never carry a credential or a key path.

## Rules (`.claude/rules/*.md`)
- Frontmatter takes only `paths`. `app.md`, `site.md`, `release.md` and this file carry the path-scoped standards; `CLAUDE.md` stays short and lists only verified facts (counts must match disk).

## Settings
- `.claude/settings.json` is tracked and is the only place hooks and the allow and ask lists live. The coding agent edits this file, never `settings.local.json`, which is gitignored and personal.
- Never commit a permission rule that names a credential path, a whole command with a PR body in it, or a bare `"Bash"`.

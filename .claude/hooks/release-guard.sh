#!/usr/bin/env bash
# release-guard.sh — PreToolUse hook (matcher: Bash). Registered in .claude/settings.json
# for every session and in the frontmatter of each agent that keeps Bash.
#
# In this repo a push to main deploys site/ to GitHub Pages (pages.yml) and feeds
# release-please; merging the Release PR tags vX.Y.Z and publishes a GitHub Release
# with the Chrome Web Store zip attached; gh release and gh workflow run can create,
# edit or rebuild that package. Each of those is a human decision (docs/RELEASING.md):
#   • interactive session         → permissionDecision "ask" (the prompt is the gate)
#   • inside a subagent           → "deny" (agent_id or agent_type is present in the event)
#   • bypassPermissions / dontAsk → "ask" cannot prompt there, so it becomes "deny"
#   • --deny                      → forces "deny" regardless of context
#
# Caught: git push (any ref or flag order, including -C, HEAD:main, --force); gh pr merge;
# gh api .../pulls/*/merge; gh release create|edit|upload|delete|delete-asset; gh api
# .../releases with a write method or fields; gh workflow run; gh api
# .../actions/workflows/*/dispatches; gh run rerun. Everything else passes silently,
# including pnpm -C app test|build, git commit, gh pr create, gh release view|download
# and gh run list.
#
# Input: the hook event as JSON on stdin. Output: JSON on stdout, or nothing. Always exits 0.
set -u
trap 'exit 0' ERR

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/hook-io.sh
source "$HOOK_DIR/lib/hook-io.sh"

FORCE_DENY=0
for arg in "$@"; do
  [ "$arg" = "--deny" ] && FORCE_DENY=1
done

hook_read_input
[ "$TOOL_NAME" = "Bash" ] || exit 0
[ -n "$TOOL_COMMAND" ] || exit 0

AGENT_ID="$(hook_json_get agent_id)"
AGENT_TYPE="$(hook_json_get agent_type)"
MODE="$(hook_json_get permission_mode)"
IN_SUBAGENT=0
if [ -n "$AGENT_ID" ] || [ -n "$AGENT_TYPE" ]; then IN_SUBAGENT=1; fi

matches() { printf '%s' "$TOOL_COMMAND" | grep -Eq "$1"; }

# A program name must start a word: preceded by start, whitespace, or a shell operator.
B='(^|[[:space:];&|(`])'
WRITE_METHOD='(-X[[:space:]]*|--method[[:space:]=]+)(POST|PUT|PATCH|DELETE)|(^|[[:space:]])(-f|-F|--field|--raw-field|--input)([[:space:]]|=)'
WHAT=""

if matches "${B}git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+|[[:space:]]+--?[^[:space:]]+)*[[:space:]]+push([[:space:]]|$)"; then
  WHAT="git push: a push to main deploys site/ to GitHub Pages and feeds release-please, and a branch push is the first half of every merge"
elif matches "${B}gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)" || matches "${B}gh[[:space:]]+api[[:space:]].*pulls/[^[:space:]/]+/merge"; then
  WHAT="merging a pull request lands it on main; merging the Release PR tags vX.Y.Z and publishes a GitHub Release with the Chrome Web Store zip"
elif matches "${B}gh[[:space:]]+release[[:space:]]+(create|edit|upload|delete|delete-asset)([[:space:]]|$)" || { matches "${B}gh[[:space:]]+api[[:space:]].*/releases" && matches "$WRITE_METHOD"; }; then
  WHAT="gh release writes change a published release or its store upload package; releases are cut by merging the Release PR, not by hand"
elif matches "${B}gh[[:space:]]+workflow[[:space:]]+run([[:space:]]|$)" || matches "${B}gh[[:space:]]+api[[:space:]].*actions/workflows/[^[:space:]]+/dispatches"; then
  WHAT="gh workflow run dispatches release-zip.yml (rebuilds and re-attaches a release zip) or pages.yml (redeploys the site)"
elif matches "${B}gh[[:space:]]+run[[:space:]]+rerun([[:space:]]|$)"; then
  WHAT="re-running a workflow can redeploy the site or re-attach a release asset"
fi

[ -n "$WHAT" ] || exit 0

if [ "$FORCE_DENY" = 1 ] || [ "$IN_SUBAGENT" = 1 ]; then
  hook_pretooluse_decision deny "Release guard (subagent): $WHAT. Subagents never push, merge, release, or dispatch workflows. Put the exact command and the verification checklist in your report; the human runs it from the main session."
elif [ "$MODE" = bypassPermissions ] || [ "$MODE" = dontAsk ]; then
  hook_pretooluse_decision deny "Release guard: $WHAT. This session runs in $MODE, where a hook cannot prompt; run the command from a session in default or auto mode, or Paul runs it by hand."
else
  hook_pretooluse_decision ask "Release guard: $WHAT. main is the deploy and release branch (docs/RELEASING.md), so this prompt is the gate. Approve only if this is the intended step."
fi
exit 0

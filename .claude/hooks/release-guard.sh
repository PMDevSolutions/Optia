#!/usr/bin/env bash
# release-guard.sh — PreToolUse hook (matcher: Bash). Registered in .claude/settings.json
# for every session and in the frontmatter of each agent that keeps Bash.
#
# In this repo a push to main deploys site/ to GitHub Pages (pages.yml) and feeds
# release-please; merging the Release PR tags vX.Y.Z and publishes a GitHub Release
# with the Chrome Web Store zip attached; gh release and gh workflow run can create,
# edit or rebuild that package. Each of those is a human decision (docs/RELEASING.md):
#   • interactive session → permissionDecision "ask" (the prompt is the gate)
#   • inside a subagent   → "deny" (agent_id or agent_type is present in the event)
#   • --deny              → forces "deny" regardless of context
# The permission mode is not special-cased, as in Paul's other repos: in bypassPermissions
# Claude Code auto-approves a hook's "ask" (verified 2026-10-26 with a dry-run push that
# named main), so there the guard is a reminder and the subagent "deny" is the only hard
# stop; the gate is CLAUDE.md's rule that nothing is pushed to main, merged, released or
# dispatched unless Paul asked for it. (Until 2026-10-26 this hook turned "ask" into "deny"
# in bypassPermissions, which blocked every push from the sessions Paul actually runs.)
#
# A plain branch push (git push -u origin <branch>, --force-with-lease included) is the
# first half of a pull request, not a deploy, and passes silently. Caught: a push that
# names main, a tag, HEAD, or no branch at all (so the current branch could be main), or
# that uses --force, --delete, --mirror, --all, --tags or a +refspec, in any flag order
# including -C and HEAD:main; gh pr merge; gh api .../pulls/*/merge; gh release
# create|edit|upload|delete|delete-asset; gh api .../releases with a write method or
# fields; gh workflow run; gh api .../actions/workflows/*/dispatches; gh run rerun.
# Everything else passes silently, including pnpm -C app test|build, git commit,
# gh pr create, gh release view|download and gh run list.
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
IN_SUBAGENT=0
if [ -n "$AGENT_ID" ] || [ -n "$AGENT_TYPE" ]; then IN_SUBAGENT=1; fi

matches() { printf '%s' "$TOOL_COMMAND" | grep -Eq "$1"; }

# A program name must start a word: preceded by start, whitespace, or a shell operator.
B='(^|[[:space:];&|(`])'
WRITE_METHOD='(-X[[:space:]]*|--method[[:space:]=]+)(POST|PUT|PATCH|DELETE)|(^|[[:space:]])(-f|-F|--field|--raw-field|--input)([[:space:]]|=)'
WHAT=""

# A push is classified by its arguments (everything after "push" up to the next shell
# operator): the first bare word is the remote, the rest are refspecs.
PUSH_GUARDED=0
PUSH_WHY=""
if matches "${B}git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+|[[:space:]]+--?[^[:space:]]+)*[[:space:]]+push([[:space:]]|$)"; then
  PUSH_ARGS="$(printf '%s' "$TOOL_COMMAND" | tr '\n' ' ' | sed -E 's/^.*[[:space:]]push([[:space:]]+|$)//; s/(&&|\|\||;|\|).*$//')"
  REMOTE_SEEN=0
  REFSPECS=0
  PUSH_WHY="no branch is named, so the current branch (which may be main) would be pushed"
  for tok in $PUSH_ARGS; do
    case "$tok" in
      --force|-f|--mirror|--all|--tags|--delete|-d|--prune)
        PUSH_GUARDED=1
        PUSH_WHY="$tok forces, deletes or mass-updates remote refs"
        ;;
      -*) ;;
      *)
        if [ "$REMOTE_SEEN" = 0 ]; then
          REMOTE_SEEN=1
        else
          REFSPECS=1
          DST="${tok#*:}"
          case "$tok" in
            +*) PUSH_GUARDED=1; PUSH_WHY="a + refspec force-updates the remote ref" ;;
            :*) PUSH_GUARDED=1; PUSH_WHY="an empty source deletes the remote ref" ;;
          esac
          case "$DST" in
            main|refs/heads/main|HEAD|refs/tags/*|v[0-9]*)
              PUSH_GUARDED=1
              PUSH_WHY="the push targets $DST, which reaches main, a tag or an unnamed branch"
              ;;
          esac
        fi
        ;;
    esac
  done
  [ "$REFSPECS" = 1 ] || PUSH_GUARDED=1
fi

if [ "$PUSH_GUARDED" = 1 ]; then
  WHAT="git push: $PUSH_WHY; a push to main deploys site/ to GitHub Pages and feeds release-please (a plain branch push, git push -u origin <branch>, passes without asking)"
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
  hook_pretooluse_decision deny "Release guard (subagent): $WHAT. Subagents never push to main, merge, release, or dispatch workflows. Put the exact command and the verification checklist in your report; the human runs it from the main session."
else
  hook_pretooluse_decision ask "Release guard: $WHAT. main is the deploy and release branch (docs/RELEASING.md), so this prompt is the gate. Approve only if this is the intended step."
fi
exit 0

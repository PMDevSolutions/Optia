#!/usr/bin/env bash
# session-context.sh — SessionStart hook (matcher: startup|resume|clear).
#
# Prints a short plain-text status block that Claude Code adds to the session's
# context: the branch and its distance from origin/main as last fetched, the
# uncommitted-file count, whether the four version fields release-please stamps
# are in lockstep, and (when gh is installed and authenticated) the open Release
# PR with its pending version, the latest GitHub Release against app/manifest.json,
# the last CI and Deploy Site conclusions on main, and the open-issue count. The
# gh calls run in parallel and each falls back to "unavailable"; set
# OPTIA_SESSION_CONTEXT_GH=0 to skip them (the tests do). Silent on any failure;
# always exits 0.
set -u
trap 'exit 0' ERR

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/hook-io.sh
source "$HOOK_DIR/lib/hook-io.sh"

hook_read_input
PROJECT="$(hook_project_dir)"
cd "$PROJECT" 2>/dev/null || exit 0
command -v git >/dev/null 2>&1 || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COUNTS="$(git rev-list --left-right --count origin/main...HEAD 2>/dev/null || echo '? ?')"
BEHIND="${COUNTS%%[[:space:]]*}"
AHEAD="${COUNTS##*[[:space:]]}"
DIRTY="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

json_key() {
  # $1 = JSON file, $2 = top-level key. Prints the value, "missing", or "unreadable".
  [ -f "$1" ] || { printf 'missing'; return 0; }
  local v=""
  if command -v jq >/dev/null 2>&1; then
    v="$(jq -r --arg k "$2" '.[$k] // empty' "$1" 2>/dev/null || true)"
  elif command -v node >/dev/null 2>&1; then
    v="$(node -e 'try{const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=j[process.argv[2]];if(v!=null)process.stdout.write(String(v))}catch{}' "$1" "$2" 2>/dev/null || true)"
  fi
  printf '%s' "${v:-unreadable}"
}

MANIFEST_V="$(json_key app/manifest.json version)"
APP_PKG_V="$(json_key app/package.json version)"
ROOT_PKG_V="$(json_key package.json version)"
RP_V="$(json_key .release-please-manifest.json .)"
LOCKSTEP="in lockstep"
if [ "$MANIFEST_V" != "$APP_PKG_V" ] || [ "$MANIFEST_V" != "$ROOT_PKG_V" ] || [ "$MANIFEST_V" != "$RP_V" ]; then
  LOCKSTEP="VERSION DRIFT (versions move only through the Release PR, docs/RELEASING.md)"
fi

RELEASE_PR="unavailable"
LATEST_REL="unavailable"
CI_RUN="unavailable"
PAGES_RUN="unavailable"
ISSUES="unavailable"
if [ "${OPTIA_SESSION_CONTEXT_GH:-1}" != 0 ] && command -v gh >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  TMP="$(mktemp -d 2>/dev/null || true)"
  if [ -n "$TMP" ] && [ -d "$TMP" ]; then
    gh pr list --state open --head release-please--branches--main--components--optia --json number,title,url >"$TMP/pr" 2>/dev/null &
    gh release view --json tagName,publishedAt >"$TMP/rel" 2>/dev/null &
    gh run list --workflow CI --branch main --limit 1 --json conclusion,status,createdAt >"$TMP/ci" 2>/dev/null &
    gh run list --workflow "Deploy Site" --branch main --limit 1 --json conclusion,status,createdAt >"$TMP/pages" 2>/dev/null &
    gh issue list --state open --limit 100 --json number >"$TMP/issues" 2>/dev/null &
    wait
    v="$(jq -r 'if length > 0 then "#\(.[0].number) \(.[0].title) (\(.[0].url))" else "none" end' "$TMP/pr" 2>/dev/null || true)"
    if [ -n "$v" ]; then RELEASE_PR="$v"; fi
    v="$(jq -r '"\(.tagName) (\(.publishedAt[:10]))"' "$TMP/rel" 2>/dev/null || true)"
    if [ -n "$v" ]; then LATEST_REL="$v"; fi
    v="$(jq -r 'if length > 0 then "\(.[0].conclusion // .[0].status) (\(.[0].createdAt[:10]))" else "no runs" end' "$TMP/ci" 2>/dev/null || true)"
    if [ -n "$v" ]; then CI_RUN="$v"; fi
    v="$(jq -r 'if length > 0 then "\(.[0].conclusion // .[0].status) (\(.[0].createdAt[:10]))" else "no runs" end' "$TMP/pages" 2>/dev/null || true)"
    if [ -n "$v" ]; then PAGES_RUN="$v"; fi
    v="$(jq -r 'length' "$TMP/issues" 2>/dev/null || true)"
    if [ -n "$v" ]; then ISSUES="$v"; fi
    rm -rf "$TMP"
  fi
fi

REL_NOTE=""
REL_TAG="${LATEST_REL%% *}"
case "$REL_TAG" in
  v*)
    if [ "v$MANIFEST_V" = "$REL_TAG" ]; then
      REL_NOTE=" and matches app/manifest.json"
    else
      REL_NOTE="; app/manifest.json is $MANIFEST_V, so a release is pending or has not been cut"
    fi
    ;;
esac

echo "Optia session context (from .claude/hooks/session-context.sh)"
if [ "$BRANCH" = "main" ]; then
  echo "- Branch: main. WARNING: a push to main deploys site/ to GitHub Pages and feeds release-please. Work on a branch and open a PR."
else
  echo "- Branch: $BRANCH ($AHEAD ahead, $BEHIND behind origin/main as last fetched)"
fi
echo "- Uncommitted changes: $DIRTY file(s)"
echo "- Versions: app/manifest.json $MANIFEST_V, app/package.json $APP_PKG_V, package.json $ROOT_PKG_V, .release-please-manifest.json $RP_V: $LOCKSTEP"
echo "- Latest GitHub Release: $LATEST_REL$REL_NOTE"
echo "- Open Release PR: $RELEASE_PR"
echo "- Last CI on main: $CI_RUN. Last Deploy Site run: $PAGES_RUN"
echo "- Open issues: $ISSUES"
echo "- Merging the Release PR is the release gate (tags, GitHub Release, store zip); the Chrome Web Store upload is manual under paul@pmds.info. The release guard asks before git push, gh pr merge, gh release writes, gh workflow run and gh run rerun, and denies them in subagents."
exit 0

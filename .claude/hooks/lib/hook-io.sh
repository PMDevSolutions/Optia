#!/usr/bin/env bash
# hook-io.sh — shared stdin/stdout contract for every hook under .claude/hooks/.
#
# Claude Code passes each hook event as JSON on stdin and reads JSON back on
# stdout (docs: https://code.claude.com/docs/en/hooks). Source this file at the
# top of a hook, after `set -u` and the `trap 'exit 0' ERR` guard:
#
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/hook-io.sh"
#   hook_read_input          # fills HOOK_EVENT, TOOL_NAME, TOOL_COMMAND, ...
#
# Field readers prefer jq (ships with macOS and every CI image used here) and
# fall back to node, which the project already requires. Every function is
# defensive: on any failure it returns an empty string so the calling hook can
# still `exit 0` and never break a session.

hook_json_get() {
  # $1 = dotted path, e.g. tool_input.command  →  prints the value or nothing.
  local path="$1"
  [ -n "${HOOK_JSON:-}" ] || return 0
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$HOOK_JSON" | jq -r --arg p "$path" '
      getpath($p | split(".")) // empty
      | if type == "string" then . else tostring end' 2>/dev/null || true
  else
    HOOK_JSON="$HOOK_JSON" node -e '
      const path = process.argv[1].split(".");
      let v; try { v = JSON.parse(process.env.HOOK_JSON); } catch { process.exit(0); }
      for (const k of path) { if (v == null) break; v = v[k]; }
      if (v == null) process.exit(0);
      process.stdout.write(typeof v === "string" ? v : JSON.stringify(v));
    ' "$path" 2>/dev/null || true
  fi
}

hook_read_input() {
  HOOK_JSON="$(cat 2>/dev/null || true)"
  HOOK_EVENT="$(hook_json_get hook_event_name)"
  TOOL_NAME="$(hook_json_get tool_name)"
  TOOL_COMMAND="$(hook_json_get tool_input.command)"
  TOOL_FILE_PATH="$(hook_json_get tool_input.file_path)"
  # tool_response is a string for Bash, an object for most other tools.
  TOOL_RESPONSE="$(hook_json_get tool_response)"
  export HOOK_JSON HOOK_EVENT TOOL_NAME TOOL_COMMAND TOOL_FILE_PATH TOOL_RESPONSE
}

hook_json_string() {
  # Encode $1 as a JSON string literal (with quotes).
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq -Rs '.' 2>/dev/null || printf '""'
  else
    node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1" 2>/dev/null || printf '""'
  fi
}

# --- Emitters: each prints one JSON document to stdout --------------------

hook_pretooluse_decision() {
  # $1 = allow | deny | ask   $2 = reason shown to the user (and to Claude on deny)
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"%s","permissionDecisionReason":%s}}\n' \
    "$1" "$(hook_json_string "$2")"
}

hook_additional_context() {
  # $1 = hook event name (PreToolUse | PostToolUse | SessionStart | UserPromptSubmit)
  # $2 = text to add to Claude's context
  printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":%s}}\n' \
    "$1" "$(hook_json_string "$2")"
}

hook_system_message() {
  # $1 = one-line message shown to the user in the transcript
  printf '{"systemMessage":%s}\n' "$(hook_json_string "$1")"
}

# --- Project helpers ------------------------------------------------------

hook_project_dir() {
  printf '%s' "${CLAUDE_PROJECT_DIR:-$(pwd)}"
}

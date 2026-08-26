#!/usr/bin/env bash
# Re-injects the active style's reminder on every prompt — fights persona drift
# over long sessions (the "system prompt repetition" baseline from "Measuring
# and Controlling Instruction (In)Stability in Language Model Dialogs",
# COLM 2024). Stdout of a UserPromptSubmit hook is added to context. Generic:
# looks up a reminder file named after the effective output style; styles
# without one inject nothing.

# Drain the JSON payload — unread stdin can break the pipe on large prompts.
cat >/dev/null

config_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# jq when present (correct JSON parsing); sed fallback keeps the hook
# dependency-free and portable (grep -P is GNU-only, absent on macOS).
# settings.json is machine-written, one key per line, so sed is safe enough.
read_style() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '.outputStyle // empty' "$1" 2>/dev/null
  else
    sed -n 's/.*"outputStyle"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -1
  fi
}

# Best-effort mirror of settings precedence (local project → project → user).
# Managed settings and --settings CLI overrides aren't consulted — good enough
# for a reminder that injects nothing when unsure. cwd is the project dir.
get_style() {
  local f v
  for f in ".claude/settings.local.json" ".claude/settings.json" "$config_dir/settings.json"; do
    [ -f "$f" ] || continue
    v="$(read_style "$f")"
    [ -n "$v" ] && { printf '%s' "$v"; return; }
  done
}

style="$(get_style)"
# Style name becomes a filename component — refuse path separators.
case "$style" in *[/\\]*) exit 0 ;; esac
[ -n "$style" ] && [ -f "$config_dir/style-reminders/$style.txt" ] && cat "$config_dir/style-reminders/$style.txt"
exit 0

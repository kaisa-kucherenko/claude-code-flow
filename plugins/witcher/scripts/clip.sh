#!/bin/bash
# Prints the clip a persona plays for one moment. The user picks it with
# /config <persona>.<key>=<clip> (turnDoneSound, needsYouSound, timerDoneSound
# in plugin.json); hooks get the pick in their environment, but the break timer
# rings from systemd, outside any session, so the user's settings.json is read
# as well. A pick with no such clip falls back to the manifest's default:
# Claude Code passes a stored value to hooks even when it is not among options.
#   clip.sh <plugin-root> <turn-done | needs-you | timer-done>
root="$1"
case "$2" in
  turn-done) key=turnDoneSound ;;
  needs-you) key=needsYouSound ;;
  timer-done) key=timerDoneSound ;;
  *) exit 1 ;;
esac
manifest="$root/.claude-plugin/plugin.json"

env_name="CLAUDE_PLUGIN_OPTION_${key^^}"
pick="${!env_name:-}"
if [[ -z "$pick" ]] && command -v jq > /dev/null; then
  me="$(jq -r .name "$manifest")"
  pick="$(jq -r --arg p "$me@" --arg k "$key" \
    'first(.pluginConfigs // {} | to_entries[] | select(.key | startswith($p)) | .value.options[$k] // empty) // empty' \
    "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json" 2> /dev/null)"
fi
# A bare name only: a value like ../../x must not reach outside sounds/
if ! [[ "$pick" =~ ^[A-Za-z0-9_-]+$ && -f "$root/sounds/$pick.oga" ]]; then
  if command -v jq > /dev/null; then
    pick="$(jq -r --arg k "$key" '.userConfig[$k].default // empty' "$manifest")"
  else
    # A fresh install has no pick yet, and the sounds played without jq before;
    # this reads the manifest as it is laid out here, one field per line
    pick="$(sed -n "/\"$key\": *{/,/}/s/^ *\"default\": *\"\([^\"]*\)\".*/\1/p" "$manifest" | head -1)"
  fi
fi
[[ -n "$pick" && -f "$root/sounds/$pick.oga" ]] || exit 1
echo "$root/sounds/$pick.oga"

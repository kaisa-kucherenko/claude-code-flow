#!/bin/bash
# Plays a short clip when a Claude Code tab wants attention. Two moments:
#   turn-done  Stop with no background work left: the answer is final, go read it
#   needs-you  a permission prompt or a question is blocking the session
# A Stop that still lists in-flight background tasks (a subagent, a shell job)
# stays silent: the session has only paused, the real end comes later.
#
# Which clip each moment plays is the user's pick, resolved by clip.sh.
# Linux only: plays through PulseAudio/PipeWire with paplay.
# CLAUDE_SOUND=off silences everything.
[[ "${CLAUDE_SOUND:-on}" == "off" ]] && exit 0
name="$1"
payload=$(cat)

if [[ "$name" == "turn-done" ]] && command -v jq > /dev/null; then
    # Only states known to be live count: an unknown status should not mute the
    # whistle for the rest of the session.
    inflight=$(printf '%s' "$payload" | jq -r '[.background_tasks[]? | select(.status == "running" or .status == "pending")] | length' 2> /dev/null || echo 0)
    (( inflight > 0 )) && exit 0
fi

root="${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}"
# Another persona on duty (or none, after off) keeps this one quiet; no file
# means nobody has chosen yet.
active_file="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/personas/active"
if [[ -f "$active_file" ]]; then
    # The manifest's first "name" is the plugin's; read without jq so the gate holds everywhere
    me=$(sed -n 's/^ *"name": *"\([^"]*\)".*/\1/p' "$root/.claude-plugin/plugin.json" | head -1)
    [[ "$(< "$active_file")" == "$me" ]] || exit 0
fi

clip="$(bash "$root/scripts/clip.sh" "$root" "$name")" || exit 0
command -v paplay > /dev/null || exit 0
paplay "$clip" 2> /dev/null &

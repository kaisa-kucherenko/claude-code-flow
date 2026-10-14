#!/bin/bash
# A one-shot break reminder for every open Claude Code session: /timer 45m.
# systemd counts the time, so the reminder rings once however many sessions are
# open and whichever of them is in front. The persona on duty when it rings
# speaks: its title, a phrase from persona/breaks.json and its timer-done clip
# (scripts/clip.sh), on its break screen (scripts/break.py) or, without one, a
# banner; with no persona on, a plain banner and the desktop's alarm sound. It
# belongs to Claude Code, not to the desktop: the last session to exit takes it
# down, and it stays silent if none is left when it is due.
#   timer.sh set <45 | 45m | 1h>   start it, replacing a running one
#   timer.sh status
#   timer.sh off
#   timer.sh reap                  a session exits: cancel if it was the last
#   timer.sh fire <id>             systemd runs this when the time is up
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
claude_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
# Outside personas/: taking a persona off empties that directory
state="$claude_dir/persona-timer"
unit=claude-persona-timer
MAX_MINUTES=1440

command -v jq > /dev/null || { echo "jq is required: sudo apt install jq" >&2; exit 1; }
mkdir -p "$state"

# The HUD polls these files, so each is replaced whole, never seen half-written
put() { printf '%s\n' "$2" > "$state/$1.tmp" && mv "$state/$1.tmp" "$state/$1"; }

label() { if (( $1 % 60 == 0 )); then echo "$(( $1 / 60 ))h"; else echo "${1}m"; fi; }

is_running() { [[ -f "$state/timer.json" ]] && systemctl --user is-active --quiet "$unit.timer"; }

stop_unit() {
  systemctl --user stop "$unit.timer" "$unit.service" 2> /dev/null || true
  systemctl --user reset-failed "$unit.timer" "$unit.service" 2> /dev/null || true
}

# Every claude process but the one asking (and whatever it runs under)
other_sessions() {
  local mine=" " pid=$$
  while [[ "$pid" =~ ^[0-9]+$ ]] && (( pid > 1 )); do
    mine+="$pid "
    pid="$(ps -o ppid= -p "$pid" 2> /dev/null | tr -d ' ')"
  done
  local p
  for p in $(pgrep -u "$(id -u)" -x claude || true); do
    [[ "$mine" == *" $p "* ]] || echo "$p"
  done
}

# Two sessions setting a timer at once would leave the unit and the state file apart
if command -v flock > /dev/null; then
  exec 9> "$state/.lock"
  # An exiting session has a second or so; the other plugin reaping at the same moment does the job
  if [[ "${1:-}" == reap ]]; then flock -n 9 || exit 0
  else flock -w 10 9 || { echo "another session is changing the timer right now, try again" >&2; exit 1; }; fi
fi

case "${1:-}" in
set)
  arg="$(echo "${2:-}" | tr -d '[:space:]' | tr 'MH' 'mh')"
  if [[ ! "$arg" =~ ^0*([1-9][0-9]{0,4})([mh]?)$ ]]; then
    echo "Use whole minutes or hours: /timer 45, /timer 90m, /timer 2h." >&2; exit 1
  fi
  minutes="${BASH_REMATCH[1]}"; [[ "${BASH_REMATCH[2]}" == h ]] && minutes=$(( minutes * 60 ))
  if (( minutes > MAX_MINUTES )); then echo "That is over a day; /timer takes up to 24h." >&2; exit 1; fi

  replaced=""
  if is_running; then replaced="$(jq -r '.minutes' "$state/timer.json")"; fi
  stop_unit
  id="$(date +%s%N)"
  env_args=(--setenv=CLAUDE_CONFIG_DIR="$claude_dir")
  [[ -n "${CLAUDE_SOUND:-}" ]] && env_args+=(--setenv=CLAUDE_SOUND="$CLAUDE_SOUND")
  if ! err="$(systemd-run --user --quiet --collect --unit="$unit" --on-active="${minutes}m" \
      --timer-property=AccuracySec=1s "${env_args[@]}" /bin/bash "$root/scripts/timer.sh" fire "$id" 2>&1)"; then
    rm -f "$state/timer.json"
    echo "systemd did not take the timer: $err" >&2; exit 1
  fi
  ends=$(( $(date +%s) + minutes * 60 ))
  put timer.json "$(jq -cn --arg id "$id" --argjson m "$minutes" --argjson e "$(( ends * 1000 ))" '{id: $id, minutes: $m, endsAt: $e}')"
  rm -f "$state/rang.json"
  at="$(date -d "@$ends" +%H:%M)"
  if [[ -n "$replaced" ]]; then
    echo "Replaced the $(label "$replaced") timer. Rings at $at."
  else
    echo "Timer set for $(label "$minutes"). Rings at $at."
  fi
  ;;
status)
  if is_running; then
    left=$(( $(jq -r '.endsAt' "$state/timer.json") / 1000 - $(date +%s) ))
    at="$(date -d "@$(( $(jq -r '.endsAt' "$state/timer.json") / 1000 ))" +%H:%M)"
    if (( left < 60 )); then echo "Less than a minute left. Rings at $at."
    else echo "$(( (left + 59) / 60 )) min left. Rings at $at."; fi
  else
    # A state file without its unit is a timer lost to a reboot or a crash
    rm -f "$state/timer.json"
    echo "No timer running. Set one: /timer 45m or /timer 1h."
  fi
  ;;
off)
  if is_running; then stop_unit; rm -f "$state/timer.json"; echo "Timer cancelled."
  else stop_unit; rm -f "$state/timer.json"; echo "No timer running."; fi
  ;;
reap)
  [[ -n "$(other_sessions)" ]] && exit 0
  stop_unit; rm -f "$state/timer.json" "$state/rang.json"
  ;;
fire)
  # A replaced or cancelled timer whose unit still got here says nothing
  [[ -f "$state/timer.json" && "$(jq -r '.id' "$state/timer.json")" == "${2:-}" ]] || exit 0
  rm -f "$state/timer.json"
  pgrep -u "$(id -u)" -x claude > /dev/null || exit 0

  title="Time for a break"; phrase="Stand up, stretch, drink some water."
  clip=/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga
  persona="$(cat "$claude_dir/personas/active" 2> /dev/null || true)"
  # Each plugin leaves its own path here at session start: the persona on duty
  # need not be the plugin that set the timer
  proot="$(cat "$state/roots/$persona" 2> /dev/null || true)"
  # Before any session has said so: the persona is this plugin, or sits beside it
  if [[ -z "$proot" && -n "$persona" ]]; then
    if [[ "$persona" == "$(jq -r .name "$root/.claude-plugin/plugin.json")" ]]; then proot="$root"
    elif [[ -f "$(dirname "$root")/$persona/persona/breaks.json" ]]; then proot="$(dirname "$root")/$persona"; fi
  fi
  breaks="$proot/persona/breaks.json"
  if [[ -n "$persona" && -n "$proot" && -f "$breaks" ]] && (( $(jq '.phrases | length' "$breaks" 2> /dev/null || echo 0) > 0 )); then
    title="$(jq -r '.title' "$breaks")"
    count="$(jq '.phrases | length' "$breaks")"
    last="$(cat "$state/last-phrase" 2> /dev/null || echo -1)"
    pick=$(( RANDOM % count ))
    # Never the same phrase twice in a row
    if (( count > 1 && pick == last )); then pick=$(( (pick + 1) % count )); fi
    put last-phrase "$pick"
    phrase="$(jq -r --argjson i "$pick" '.phrases[$i]' "$breaks")"
    clip="$(bash "$proot/scripts/clip.sh" "$proot" timer-done)" || clip=""
  else
    persona=""
  fi
  put rang.json "$(jq -cn --arg id "$2" --arg p "$persona" --arg t "$title" --arg ph "$phrase" '{id: $id, persona: $p, title: $t, phrase: $ph}')"
  # The clip and the break screen run for a while; a /timer typed meanwhile should not wait on them
  exec 9>&-
  if [[ "${CLAUDE_SOUND:-on}" != off && -f "$clip" ]] && command -v paplay > /dev/null; then
    paplay "$clip" 2> /dev/null &
  fi
  # A persona with a break screen shows it instead of the banner. It stays in the
  # foreground: systemd kills what is left of the unit once this script exits.
  # A screen that fails to start still rings with the banner, and its error lands
  # in the unit's journal
  if [[ -n "$persona" && -x "$proot/scripts/break.py" ]]; then
    "$proot/scripts/break.py" "$proot" "$title" "$phrase" \
      || notify-send --app-name="Claude Code" "$title" "$phrase" 2> /dev/null || true
  else
    notify-send --app-name="Claude Code" "$title" "$phrase" 2> /dev/null || true
  fi
  wait || true
  ;;
*) echo "usage: timer.sh set <45 | 45m | 1h> | status | off | reap | fire <id>" >&2; exit 1 ;;
esac

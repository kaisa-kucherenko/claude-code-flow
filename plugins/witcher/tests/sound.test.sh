#!/bin/bash
# Runs sound.sh with paplay stubbed, to check which persona gets to play and
# which clip it picks.
#   bash tests/sound.test.sh
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)" || exit 1; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/cfg/personas"
printf '#!/bin/bash\necho "$1" >> "%s/played"\n' "$tmp" > "$tmp/bin/paplay"; chmod +x "$tmp/bin/paplay"
export CLAUDE_CONFIG_DIR="$tmp/cfg" CLAUDE_PLUGIN_ROOT="$root" PATH="$tmp/bin:$PATH"
me="$(jq -r .name "$root/.claude-plugin/plugin.json")"

failed=0
plays() { # name, expected yes|no, payload
  rm -f "$tmp/played"
  echo "$3" | bash "$root/scripts/sound.sh" turn-done; wait; sleep 0.2
  if [[ -f "$tmp/played" ]]; then got=yes; else got=no; fi
  if [[ "$got" == "$2" ]]; then echo "ok   $1"; else echo "FAIL $1 (played: $got)"; failed=1; fi
}

rm -f "$tmp/cfg/personas/active"
plays "plays when no persona has been chosen" yes '{}'
echo "$me" > "$tmp/cfg/personas/active"
plays "plays when this persona is on duty" yes '{}'
echo someone-else > "$tmp/cfg/personas/active"
plays "stays quiet while another persona is on duty" no '{}'
echo none > "$tmp/cfg/personas/active"
plays "stays quiet after off" no '{}'
echo "$me" > "$tmp/cfg/personas/active"
plays "waits while a background task is running" no '{"background_tasks":[{"status":"running"}]}'
plays "plays once background tasks have finished" yes '{"background_tasks":[{"status":"completed"},{"status":"killed"}]}'
CLAUDE_SOUND=off plays "CLAUDE_SOUND=off mutes it" no '{}'

manifest="$root/.claude-plugin/plugin.json"
default() { jq -r ".userConfig.$1.default" "$manifest"; }
# Any clip but the default, so a pick that is ignored can't pass for one that works
other() { jq -r --arg d "$(default "$1")" ".userConfig.$1.options | map(select(. != \$d)) | first" "$manifest"; }
clip() { # name, event, expected clip name, extra env...
  local name="$1" event="$2" want="$3"; shift 3
  rm -f "$tmp/played"
  echo '{}' | env "$@" bash "$root/scripts/sound.sh" "$event"; wait; sleep 0.2
  got="$(cat "$tmp/played" 2> /dev/null)"
  if [[ "$got" == "$root/sounds/$want.oga" ]]; then echo "ok   $name"; else echo "FAIL $name (played: ${got:-nothing})"; failed=1; fi
}

for key in turnDoneSound needsYouSound timerDoneSound; do
  for opt in $(jq -r ".userConfig.$key.options[]" "$manifest"); do
    [[ -f "$root/sounds/$opt.oga" ]] || { echo "FAIL $key offers $opt, which has no clip"; failed=1; }
  done
  [[ -n "$(other "$key")" && "$(other "$key")" != null ]] || { echo "FAIL $key offers no choice"; failed=1; }
done
for f in "$root"/sounds/*.oga; do
  n="$(basename "$f" .oga)"
  jq -e --arg n "$n" '[.userConfig.turnDoneSound, .userConfig.needsYouSound, .userConfig.timerDoneSound] | all(.options | index($n))' "$manifest" > /dev/null \
    || { echo "FAIL $n is in sounds/ but not offered for every moment"; failed=1; }
done

clip "with no pick, the answer plays its default" turn-done "$(default turnDoneSound)"
clip "with no pick, a question plays its default" needs-you "$(default needsYouSound)"
clip "the hook's pick plays instead" turn-done "$(other turnDoneSound)" CLAUDE_PLUGIN_OPTION_TURNDONESOUND="$(other turnDoneSound)"
clip "a pick for one moment leaves the other alone" needs-you "$(default needsYouSound)" CLAUDE_PLUGIN_OPTION_TURNDONESOUND="$(other turnDoneSound)"
clip "a clip that doesn't exist falls back to the default" turn-done "$(default turnDoneSound)" CLAUDE_PLUGIN_OPTION_TURNDONESOUND=no-such-clip
mkdir -p "$tmp/outside"; cp "$root/sounds/$(other turnDoneSound).oga" "$tmp/outside/escape.oga"
clip "a path can't reach outside sounds/" turn-done "$(default turnDoneSound)" CLAUDE_PLUGIN_OPTION_TURNDONESOUND="../../../../../../..$tmp/outside/escape"
# A fresh install has no pick, and jq is not on every machine
mkdir -p "$tmp/nojq"
for c in bash cat sed head dirname; do ln -s "$(command -v "$c")" "$tmp/nojq/$c"; done
ln -s "$tmp/bin/paplay" "$tmp/nojq/paplay"
clip "without jq, the answer still plays its default" turn-done "$(default turnDoneSound)" PATH="$tmp/nojq"
clip "without jq, a question still plays its default" needs-you "$(default needsYouSound)" PATH="$tmp/nojq"
jq -n --arg k "$me@claude-code-flow" --arg v "$(other needsYouSound)" '{pluginConfigs: {($k): {options: {needsYouSound: $v}}}}' > "$tmp/cfg/settings.json"
clip "without the hook's env, the pick in settings.json plays" needs-you "$(other needsYouSound)"
rm -f "$tmp/cfg/settings.json"

exit $failed

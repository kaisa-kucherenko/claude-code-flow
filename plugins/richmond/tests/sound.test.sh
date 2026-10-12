#!/bin/bash
# Runs sound.sh with paplay stubbed, to check which persona gets to play.
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

exit $failed

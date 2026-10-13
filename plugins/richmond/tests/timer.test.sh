#!/bin/bash
# Runs timer.sh against a throwaway config dir, with systemd, pgrep, the banner
# and the player stubbed, so no real timer is set and nothing rings.
#   bash tests/timer.test.sh
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
timer="$root/scripts/timer.sh"
tmp="$(mktemp -d)" || exit 1; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/cfg/personas"
export CLAUDE_CONFIG_DIR="$tmp/cfg" PATH="$tmp/bin:$PATH"
unset CLAUDE_SOUND
state="$tmp/cfg/persona-timer"; calls="$tmp/calls.log"

# The stub unit is "active" while $tmp/unit exists
cat > "$tmp/bin/systemd-run" <<EOF
#!/bin/bash
echo "systemd-run \$*" >> "$calls"; touch "$tmp/unit"
EOF
cat > "$tmp/bin/systemctl" <<EOF
#!/bin/bash
echo "systemctl \$*" >> "$calls"
case "\$2" in
  is-active) [[ -f "$tmp/unit" ]] ;;
  stop) rm -f "$tmp/unit" ;;
esac
EOF
# Live claude processes, one pid per line in $tmp/claudes
printf '#!/bin/bash\ncat "%s/claudes" 2> /dev/null; [[ -s "%s/claudes" ]]\n' "$tmp" "$tmp" > "$tmp/bin/pgrep"
printf '#!/bin/bash\necho "notify-send $*" >> "%s"\n' "$calls" > "$tmp/bin/notify-send"
printf '#!/bin/bash\necho "paplay $*" >> "%s"\n' "$calls" > "$tmp/bin/paplay"
chmod +x "$tmp/bin"/*

failed=0
expect() { # name, command that must succeed
  if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; failed=1; fi
}
reset() { rm -rf "$state" "$tmp/unit" "$calls"; echo 4242 > "$tmp/claudes"; }
fire_id() { jq -r .id "$state/timer.json"; }

reset
out="$(bash "$timer" set 45)"
expect "a bare number is minutes" '[[ "$(jq .minutes "$state/timer.json")" == 45 ]]'
expect "systemd counts the 45 minutes" 'grep -q -- "--on-active=45m" "$calls"'
expect "the report says how long and when it rings" '[[ "$out" =~ ^Timer\ set\ for\ 45m\.\ Rings\ at\ [0-9]{2}:[0-9]{2}\.$ ]]'
ends="$(jq .endsAt "$state/timer.json")"; now_ms=$(( $(date +%s) * 1000 ))
expect "the band's end time is 45 minutes out" '(( ends - now_ms >= 2699000 && ends - now_ms <= 2701000 ))'
expect "the fire step carries this timer's id" 'grep -q "fire $(fire_id)" "$calls"'

out="$(bash "$timer" set 1h)"
expect "a new timer replaces the running one and says so" '[[ "$out" == "Replaced the 45m timer."* ]]'
expect "the old unit is stopped first" 'grep -q "systemctl --user stop claude-persona-timer.timer" "$calls"'
expect "hours are counted in minutes" '[[ "$(jq .minutes "$state/timer.json")" == 60 ]]'
out="$(bash "$timer" set 90M)"
expect "minutes that are not whole hours read as minutes" '[[ "$out" == "Replaced the 1h timer."* && "$(jq .minutes "$state/timer.json")" == 90 ]]'

before="$(cat "$state/timer.json")"
for bad in 0m 1.5h 1h30m abc -5m ""; do
  bash "$timer" set "$bad" > /dev/null 2> "$tmp/err"; code=$?
  expect "'$bad' is refused with the usage" '(( code == 1 )) && grep -q "Use whole minutes or hours" "$tmp/err"'
done
bash "$timer" set 25h > /dev/null 2> "$tmp/err"; code=$?
expect "over a day is refused" '(( code == 1 )) && grep -q "up to 24h" "$tmp/err"'
expect "a refused argument leaves the running timer alone" '[[ "$(cat "$state/timer.json")" == "$before" && -f "$tmp/unit" ]]'

expect "status while running says what is left" '[[ "$(bash "$timer" status)" =~ ^(89|90)\ min\ left\.\ Rings\ at ]]'
expect "off cancels it" '[[ "$(bash "$timer" off)" == "Timer cancelled." && ! -f "$state/timer.json" && ! -f "$tmp/unit" ]]'
expect "status with none says how to set one" '[[ "$(bash "$timer" status)" == "No timer running."* ]]'
expect "off with none says so" '[[ "$(bash "$timer" off)" == "No timer running." ]]'

reset; bash "$timer" set 10 > /dev/null; rm -f "$tmp/unit"
expect "a state file whose unit is gone counts as no timer" '[[ "$(bash "$timer" status)" == "No timer running."* && ! -f "$state/timer.json" ]]'

# Firing: the persona on duty speaks, whichever plugin set the timer
mkdir -p "$tmp/other/persona" "$tmp/other/sounds" "$tmp/other/scripts" "$tmp/other/.claude-plugin"
echo '{"title": "Тайм-аут", "phrases": ["раз", "два", "три"]}' > "$tmp/other/persona/breaks.json"
echo '{"name": "other", "userConfig": {"timerDoneSound": {"options": ["gong", "bell"], "default": "gong"}}}' > "$tmp/other/.claude-plugin/plugin.json"
touch "$tmp/other/sounds/gong.oga" "$tmp/other/sounds/bell.oga"
cp "$root/scripts/clip.sh" "$tmp/other/scripts/"
reset; mkdir -p "$state/roots"; echo "$tmp/other" > "$state/roots/other"; echo other > "$tmp/cfg/personas/active"
bash "$timer" set 5 > /dev/null; id="$(fire_id)"
bash "$timer" fire "$id"
expect "on time it marks the band and drops the timer" '[[ "$(jq -r .id "$state/rang.json")" == "$id" && ! -f "$state/timer.json" ]]'
expect "the banner carries the persona on duty's title" 'grep -q "notify-send --app-name=Claude Code Тайм-аут" "$calls"'
expect "the clip is that persona's default timer clip" 'grep -q "paplay $tmp/other/sounds/gong.oga" "$calls"'

# systemd hands the fire no session environment, so the pick comes from settings.json
echo '{"pluginConfigs": {"other@claude-code-flow": {"options": {"timerDoneSound": "bell"}}}}' > "$tmp/cfg/settings.json"
bash "$timer" set 5 > /dev/null; : > "$calls"; bash "$timer" fire "$(fire_id)"
expect "the persona's pick in settings.json rings instead" 'grep -q "paplay $tmp/other/sounds/bell.oga" "$calls"'
rm -f "$tmp/cfg/settings.json"

prev=""; repeated=no
for _ in $(seq 12); do
  bash "$timer" set 5 > /dev/null; bash "$timer" fire "$(fire_id)"
  phrase="$(jq -r .phrase "$state/rang.json")"; [[ "$phrase" == "$prev" ]] && repeated=yes; prev="$phrase"
done
expect "the same phrase never comes twice in a row" '[[ "$repeated" == no ]]'

bash "$timer" set 5 > /dev/null; old="$(fire_id)"; bash "$timer" set 6 > /dev/null; : > "$calls"
bash "$timer" fire "$old"
expect "a replaced timer's late fire says nothing" '[[ ! -s "$calls" && -f "$state/timer.json" ]]'

: > "$tmp/claudes"; bash "$timer" fire "$(fire_id)"
expect "with no session left it stays silent" '! grep -q notify-send "$calls" && [[ ! -f "$state/timer.json" ]]'

echo 4242 > "$tmp/claudes"; echo none > "$tmp/cfg/personas/active"
bash "$timer" set 5 > /dev/null; bash "$timer" fire "$(fire_id)"
expect "with no persona on, a plain banner" 'grep -q "notify-send --app-name=Claude Code Time for a break" "$calls"'
expect "and the desktop's own alarm" 'grep -q "paplay /usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga" "$calls" || [[ ! -f /usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga ]]'

echo other > "$tmp/cfg/personas/active"; : > "$calls"
bash "$timer" set 5 > /dev/null; CLAUDE_SOUND=off bash "$timer" fire "$(fire_id)"
expect "CLAUDE_SOUND=off keeps the banner and mutes the clip" 'grep -q notify-send "$calls" && ! grep -q paplay "$calls"'

# With no session having left its path yet, the plugin still finds itself
me="$(jq -r .name "$root/.claude-plugin/plugin.json")"
reset; echo "$me" > "$tmp/cfg/personas/active"
bash "$timer" set 5 > /dev/null; bash "$timer" fire "$(fire_id)"
expect "without roots, this plugin's own persona still speaks" 'grep -q "paplay $root/sounds/$(jq -r .userConfig.timerDoneSound.default "$root/.claude-plugin/plugin.json").oga" "$calls" && [[ "$(jq -r .persona "$state/rang.json")" == "$me" ]]'

# A persona whose phrase list is empty falls back to the plain banner instead of failing
echo '{"title": "Тайм-аут", "phrases": []}' > "$tmp/other/persona/breaks.json"
reset; mkdir -p "$state/roots"; echo "$tmp/other" > "$state/roots/other"; echo other > "$tmp/cfg/personas/active"
bash "$timer" set 5 > /dev/null; bash "$timer" fire "$(fire_id)"
expect "an empty phrase list still rings, with the plain banner" 'grep -q "notify-send --app-name=Claude Code Time for a break" "$calls"'

# systemd refusing the timer must not leave a countdown behind
reset; mv "$tmp/bin/systemd-run" "$tmp/systemd-run.ok"
printf '#!/bin/bash\necho "Failed to start transient timer unit" >&2; exit 1\n' > "$tmp/bin/systemd-run"; chmod +x "$tmp/bin/systemd-run"
bash "$timer" set 5 > /dev/null 2> "$tmp/err"; code=$?
expect "a timer systemd refused is reported and leaves no state" '(( code == 1 )) && grep -q "systemd did not take the timer" "$tmp/err" && [[ ! -f "$state/timer.json" ]]'
mv "$tmp/systemd-run.ok" "$tmp/bin/systemd-run"

# Reaping: only the last session to exit takes the timer down
reset; bash "$timer" set 5 > /dev/null
echo 999999 > "$tmp/claudes"; bash "$timer" reap
expect "another session still open keeps the timer" '[[ -f "$state/timer.json" && -f "$tmp/unit" ]]'
echo '{"id": "old"}' > "$state/rang.json"
echo $$ > "$tmp/claudes"; bash "$timer" reap
expect "the last one out cancels it" '[[ ! -f "$state/timer.json" && ! -f "$tmp/unit" ]]'
expect "and clears a ring nobody came back to" '[[ ! -f "$state/rang.json" ]]'

exit $failed

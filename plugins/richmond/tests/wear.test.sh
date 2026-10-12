#!/bin/bash
# Runs wear.sh against a throwaway config dir, with gsettings, dconf and
# gnome-terminal stubbed so the real desktop is never touched.
#   bash tests/wear.test.sh
set -uo pipefail
wear="$(cd "$(dirname "$0")/.." && pwd)/scripts/wear.sh"
tmp="$(mktemp -d)" || exit 1; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/cfg"
export CLAUDE_CONFIG_DIR="$tmp/cfg" PATH="$tmp/bin:$PATH"
cfg="$tmp/cfg/settings.json"; calls="$tmp/calls.log"

for c in gnome-terminal dconf; do
  printf '#!/bin/bash\necho "%s $*" >> "%s"; cat > /dev/null\n' "$c" "$calls" > "$tmp/bin/$c"
done
cat > "$tmp/bin/gsettings" <<EOF
#!/bin/bash
echo "gsettings \$*" >> "$calls"
case "\$1 \$3" in "get list") echo "['own-profile']" ;; "get default") echo "'own-profile'" ;; esac
EOF
chmod +x "$tmp/bin"/*

failed=0
check() { # name, jq expression that must be true on settings.json
  if jq -e "$2" "$cfg" > /dev/null; then echo "ok   $1"; else echo "FAIL $1"; failed=1; fi
}
expect() { # name, command that must succeed
  if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; failed=1; fi
}

cat > "$cfg" <<'EOF'
{
  "theme": "light",
  "statusLine": { "type": "command", "command": "~/own-statusline.sh" },
  "model": "opus",
  "enabledPlugins": { "richmond@flow": true, "witcher@flow": true, "other@x": true }
}
EOF
cp "$cfg" "$tmp/original.json"

bash "$wear" on > /dev/null
check "on sets the plugin theme under the plugin's name" '.theme == "custom:richmond:nelson-road"'
check "on points the status lines at stable copies" \
  '(.statusLine.command | endswith("/personas/richmond/statusline.sh\u0027")) and (.subagentStatusLine.command | endswith("/personas/richmond/subagent-statusline.sh\u0027"))'
check "on sets spinner verbs and tips" '(.spinnerVerbs.verbs | length) > 0 and (.spinnerTipsOverride.tipsFile | endswith("/personas/richmond/tips.json"))'
check "on leaves every plugin enabled" '.enabledPlugins == {"richmond@flow": true, "witcher@flow": true, "other@x": true}'
expect "on puts this persona on duty" '[[ "$(< "$tmp/cfg/personas/active")" == richmond ]]'
expect "on copies the files the settings point at" '[[ -x "$tmp/cfg/personas/richmond/statusline.sh" && -f "$tmp/cfg/personas/richmond/tips.json" ]]'
expect "on makes the terminal profile the default" 'grep -q "gsettings set org.gnome.Terminal.ProfilesList default aa2a6a69" "$calls"'

bash "$wear" on diamond-dogs > /dev/null
check "switching themes keeps the first backup" '.theme == "custom:richmond:diamond-dogs"'
expect "the backup still holds the person's own theme" '[[ "$(jq -r .theme "$tmp/cfg/personas/backup.json")" == light ]]'

jq '.model = "sonnet" | .permissions.allow = ["Bash(ls:*)"]' "$cfg" > "$cfg.t" && mv "$cfg.t" "$cfg"
: > "$calls"
bash "$wear" off > /dev/null
check "off restores the persona keys and drops the ones that were unset" \
  '.theme == "light" and .statusLine.command == "~/own-statusline.sh" and (has("spinnerVerbs") | not) and (has("subagentStatusLine") | not)'
check "off keeps settings changed while the persona was on" '.model == "sonnet" and .permissions.allow == ["Bash(ls:*)"]'
check "off leaves the plugins enabled" '.enabledPlugins == {"richmond@flow": true, "witcher@flow": true, "other@x": true}'
expect "off restores the person's terminal profile" 'grep -q "default own-profile" "$calls"'
expect "off keeps only the marker that no persona is on duty" '[[ "$(ls "$tmp/cfg/personas")" == active && "$(< "$tmp/cfg/personas/active")" == none ]]'

before="$(cat "$cfg")"
bash "$wear" on anfield > /dev/null 2>&1; code=$?
expect "an unknown theme fails" '[[ $code -ne 0 ]]'
expect "an unknown theme leaves settings and the marker untouched" '[[ "$(cat "$cfg")" == "$before" && "$(< "$tmp/cfg/personas/active")" == none ]]'

expect "off with nothing on is a no-op" 'bash "$wear" off > /dev/null && [[ "$(cat "$cfg")" == "$before" ]]'

jq '.enabledPlugins["richmond@flow"] = false' "$cfg" > "$cfg.t" && mv "$cfg.t" "$cfg"
bash "$wear" on > /dev/null
check "on turns its own plugin back on" '.enabledPlugins["richmond@flow"] == true'
bash "$wear" off > /dev/null

rm "$cfg"
bash "$wear" on > /dev/null
check "on works without a settings.json" '.theme == "custom:richmond:nelson-road"'
bash "$wear" off > /dev/null
check "off then leaves an empty settings.json behind" '. == {}'

export CLAUDE_CONFIG_DIR="$tmp/it's a dir"; cfg="$CLAUDE_CONFIG_DIR/settings.json"
bash "$wear" on > /dev/null
expect "the status line command survives a space and a quote in the path" \
  'echo "{}" | sh -c "$(jq -r .statusLine.command "$cfg")" > /dev/null'

exit $failed

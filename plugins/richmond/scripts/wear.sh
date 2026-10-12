#!/bin/bash
# Puts this persona on, or takes every persona off, in the parts of Claude Code
# a plugin cannot carry: the settings.json keys for the theme, spinner verbs and
# tips, the status line and the subagent panel, plus a GNOME Terminal profile.
# The first `on` saves what those keys held, so `off` brings back the person's
# own values even after switching between personas. Only those keys are
# touched: everything else in settings.json stays as it is.
#   wear.sh on [theme]   a theme from persona/persona.json, its default if left out
#   wear.sh off
set -euo pipefail
action="${1:-}"
root="$(cd "$(dirname "$0")/.." && pwd)"
persona="$(jq -r .name "$root/.claude-plugin/plugin.json")"
meta="$root/persona/persona.json"
claude_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
cfg="$claude_dir/settings.json"
state="$claude_dir/personas"
backup="$state/backup.json"
# Personas are mutually exclusive: two HUDs and two sets of sounds fight.
PERSONAS='["witcher", "richmond"]'
KEYS='["theme", "spinnerVerbs", "spinnerTipsOverride", "statusLine", "subagentStatusLine"]'

write_cfg() { jq "$@" "$cfg" > "$cfg.tmp" && mv "$cfg.tmp" "$cfg"; }
has_gnome_terminal() { command -v gnome-terminal > /dev/null && command -v gsettings > /dev/null && command -v dconf > /dev/null; }

command -v jq > /dev/null || { echo "потрібен jq: sudo apt install jq" >&2; exit 1; }
[[ -f "$cfg" ]] || { mkdir -p "$claude_dir"; echo '{}' > "$cfg"; }

case "$action" in
on)
  theme="${2:-$(jq -r .defaultTheme "$meta")}"
  if ! jq -e --arg t "$theme" '.themes | has($t)' "$meta" > /dev/null; then
    echo "нема теми $theme, є: $(jq -r '.themes | keys_unsorted | join(", ")' "$meta")" >&2
    exit 1
  fi

  if [[ ! -f "$backup" ]]; then
    mkdir -p "$state"
    term_default=null
    has_gnome_terminal && term_default="$(gsettings get org.gnome.Terminal.ProfilesList default | tr -d "'" | jq -R .)"
    jq --argjson keys "$KEYS" --argjson td "$term_default" \
      '. as $s | (reduce $keys[] as $k ({}; .[$k] = $s[$k])) + {terminalDefault: $td}' \
      "$cfg" > "$backup"
  fi

  # Settings point at copies, not into the plugin: the plugin's directory moves
  # with every update, and a stale path would blank the status line.
  find "$state" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
  mkdir -p "$state/$persona"
  cp "$root/persona/statusline.sh" "$root/persona/subagent-statusline.sh" "$root/persona/tips.json" "$state/$persona/"

  # A plugin's theme is listed under its plugin's name: custom:<plugin>:<file>.
  write_cfg --slurpfile verbs "$root/persona/verbs.json" --arg dir "$state/$persona" \
    --arg tips_label "$(jq -r .tipsLabel "$meta")" --arg theme "custom:$persona:$theme" --arg me "$persona" \
    --argjson personas "$PERSONAS" '
    .theme = $theme
    | .spinnerVerbs = $verbs[0]
    | .spinnerTipsOverride = {excludeDefault: true, tipsFile: "\($dir)/tips.json", label: $tips_label}
    | .statusLine = {type: "command", command: ($dir + "/statusline.sh" | @sh)}
    | .subagentStatusLine = {type: "command", command: ($dir + "/subagent-statusline.sh" | @sh)}
    | if .enabledPlugins then
        .enabledPlugins |= with_entries(
          (.key | split("@")[0]) as $n
          | if $n == $me then .value = true
            elif ($personas | index($n)) != null then .value = false
            else . end)
      else . end'
  echo "$(jq -r .wornMessage "$meta"): тема $theme, спінер, підказки, statusline, панель субагентів."

  if has_gnome_terminal; then
    uuid="$(jq -r --arg t "$theme" '.themes[$t].terminalProfile' "$meta")"
    dconf load "/org/gnome/terminal/legacy/profiles:/:$uuid/" < "$root/persona/terminal/$theme.dconf"
    list="$(gsettings get org.gnome.Terminal.ProfilesList list)"
    if [[ "$list" != *"$uuid"* ]]; then
      if [[ "$list" == "@as []" ]]; then list="['$uuid']"; else list="${list%]}, '$uuid']"; fi
      gsettings set org.gnome.Terminal.ProfilesList list "$list"
    fi
    gsettings set org.gnome.Terminal.ProfilesList default "$uuid"
    echo "GNOME Terminal: нові вкладки відкриваються з профілем $theme."
  fi
  ;;
off)
  [[ -f "$backup" ]] || { echo "Персону не вдягнено, знімати нічого."; exit 0; }
  write_cfg --slurpfile b "$backup" --argjson keys "$KEYS" --argjson personas "$PERSONAS" '
    $b[0] as $b
    | reduce $keys[] as $k (.; if $b[$k] == null then del(.[$k]) else .[$k] = $b[$k] end)
    | if .enabledPlugins then
        .enabledPlugins |= with_entries(
          (.key | split("@")[0]) as $n
          | if ($personas | index($n)) != null then .value = false else . end)
      else . end'
  term_default="$(jq -r '.terminalDefault // empty' "$backup")"
  if [[ -n "$term_default" ]] && has_gnome_terminal; then
    gsettings set org.gnome.Terminal.ProfilesList default "$term_default"
  fi
  rm -rf "$state"
  echo "Персону знято: налаштування повернуто, плагіни персон вимкнено."
  ;;
*) echo "використання: wear.sh on [тема] | off" >&2; exit 1 ;;
esac

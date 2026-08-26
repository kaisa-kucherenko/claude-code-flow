#!/bin/bash
# Minimal: muted grays, color only for context %

input=$(cat)

# Use jq if available (faster), fallback to python
if command -v jq &>/dev/null; then
    eval "$(echo "$input" | jq -r '
        @sh "cwd=\(.workspace.current_dir // "")",
        @sh "project_dir=\(.workspace.project_dir // "")",
        @sh "model=\(.model.display_name // "Sonnet")",
        @sh "style=\(.output_style.name // "")",
        @sh "context_percent=\(.context_window.used_percentage // 0 | floor)",
        @sh "five_h=\(.rate_limits.five_hour.used_percentage // "" | if . == "" then "" else floor end)",
        @sh "five_h_reset=\(.rate_limits.five_hour.resets_at // "")",
        @sh "week=\(.rate_limits.seven_day.used_percentage // "" | if . == "" then "" else floor end)"
    ')"
else
    {
    read -r cwd
    read -r project_dir
    read -r model
    read -r style
    read -r context_percent
    read -r five_h
    read -r five_h_reset
    read -r week
    } < <(python3 -c '
import sys,json
d=json.load(sys.stdin)
rl=d.get("rate_limits") or {}
fh=rl.get("five_hour") or {}
sd=rl.get("seven_day") or {}
print(d.get("workspace",{}).get("current_dir",""))
print(d.get("workspace",{}).get("project_dir",""))
print(d.get("model",{}).get("display_name","Sonnet"))
print(d.get("output_style",{}).get("name",""))
print(int(d.get("context_window",{}).get("used_percentage",0)))
print("" if fh.get("used_percentage") is None else int(fh["used_percentage"]))
print(fh.get("resets_at") or "")
print("" if sd.get("used_percentage") is None else int(sd["used_percentage"]))
' <<< "$input")
fi

# Relative path from project root
if [[ -n "$project_dir" && -n "$cwd" ]]; then
    display_path="${project_dir##*/}${cwd#"$project_dir"}"
else
    display_path="${cwd/#$HOME/~}"
fi

# Git branch (works in subdirectories)
branch=""
if [[ -n "$cwd" ]]; then
    branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
    # Truncate long branch names to keep the status line on one line
    if [[ ${#branch} -gt 30 ]]; then
        branch="${branch:0:27}..."
    fi
fi

# Virtualenv
venv=""
[[ -n "$VIRTUAL_ENV" ]] && venv="(${VIRTUAL_ENV##*/}) "

# Colors - minimal palette. 256-color codes only: Claude Code force-dims the
# statusline, and 16-color codes come out olive/washed on top of that; explicit
# 256-color foregrounds survive the dimming (see claude-code issue #42382).
DIM='\033[2;37m'          # Dim white — labels/chrome only, never numbers
PURPLE='\033[38;5;183m'   # Lilac/lavender
RESET='\033[0m'
GREEN='\033[38;5;78m'     # True green (16-color 32 renders olive here)
YELLOW='\033[38;5;221m'
AMBER='\033[38;5;214m'    # Burshtyn — usage limits warning tier
RED='\033[38;5;203m'

# Build output
out="${DIM}${venv}${display_path}${RESET}"
[[ -n "$branch" ]] && out+=" ${DIM}⎇ ${branch}${RESET}"
if [[ -n "$style" && "$style" != "default" ]]; then
    out+=" ${PURPLE}[${model} / ${style}]${RESET}"
else
    out+=" ${PURPLE}[${model}]${RESET}"
fi

# Context % with traffic light colors
context_percent=${context_percent:-0}
if (( context_percent > 0 )); then
    if (( context_percent < 30 )); then
        out+=" ${GREEN}${context_percent}%${RESET}"
    elif (( context_percent < 40 )); then
        out+=" ${YELLOW}${context_percent}%${RESET}"
    else
        out+=" ${RED}${context_percent}%${RESET}"
    fi
fi

# Usage windows (Pro/Max only — absent until the first API response).
# Green <70, amber 70-89, red >=90. 5h always shows reset time.
usage_color() {
    if (( $1 < 70 )); then echo -n "$GREEN"
    elif (( $1 < 90 )); then echo -n "$AMBER"
    else echo -n "$RED"; fi
}
if [[ -n "$five_h" ]]; then
    out+=" ${DIM}| 5h${RESET} $(usage_color "$five_h")${five_h}%${RESET}"
    if [[ -n "$five_h_reset" ]]; then
        # GNU date first; BSD/macOS date needs -r for epoch input
        reset_hm=$(date -d "@${five_h_reset}" +%H:%M 2>/dev/null || date -r "${five_h_reset}" +%H:%M 2>/dev/null)
        [[ -n "$reset_hm" ]] && out+="${DIM} → ${reset_hm}${RESET}"
    fi
fi
if [[ -n "$week" ]]; then
    out+=" ${DIM}| 7d${RESET} $(usage_color "$week")${week}%${RESET}"
fi

echo -e "$out"

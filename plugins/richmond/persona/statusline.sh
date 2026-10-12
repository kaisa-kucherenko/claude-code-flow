#!/bin/bash
# AFC Richmond status line: the project is the stadium (⚑), the default branch
# is a home game, a working branch an away game whose score is commits ahead :
# behind the default branch. Then [model | effort] and the output style.
# Needs jq; stdin is the status line JSON Claude Code sends on every refresh.

eval "$(jq -r '
    @sh "cwd=\(.workspace.current_dir // "")",
    @sh "project_dir=\(.workspace.project_dir // "")",
    @sh "model=\(.model.display_name // "")",
    @sh "style=\(.output_style.name // "")",
    @sh "effort=\(.effort.level // "")"
')"

if [[ -n "$project_dir" && -n "$cwd" ]]; then
    display_path="${project_dir##*/}${cwd#"$project_dir"}"
else
    # Escaped tilde: a bare ~ in the replacement expands back to $HOME
    display_path="${cwd/#$HOME/\~}"
fi

branch=""
[[ -n "$cwd" ]] && branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
# Long branch names would push the model off a one-line status bar
[[ ${#branch} -gt 30 ]] && branch="${branch:0:27}..."

venv=""
[[ -n "$VIRTUAL_ENV" ]] && venv="(${VIRTUAL_ENV##*/}) "

# 256-colour codes only: Claude Code dims the status line, and 16-colour codes
# come out washed on top of that, while explicit 256-colour foregrounds survive.
DIM='\033[2;37m'
KIT_HOME='\033[38;5;203m'  # red half of the shirt
KIT_AWAY='\033[38;5;153m'  # blue half, lightened to read on the navy theme
CREST='\033[38;5;220m'     # yellow of the crest; a text glyph, since emoji ignore colour
MODEL='\033[38;5;147m'
STYLE='\033[38;5;217m'
RESET='\033[0m'

out="${CREST}⚑${RESET} ${DIM}${venv}${display_path}${RESET}"
if [[ -n "$branch" ]]; then
    default=$(git -C "$cwd" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null)
    if [[ -z "$default" ]]; then
        for b in main master; do
            git -C "$cwd" rev-parse -q --verify "refs/heads/$b" > /dev/null && { default=$b; break; }
        done
    fi
    if [[ "$branch" == "${default#origin/}" ]]; then
        out+="  ${KIT_HOME}ВДОМА · ${branch}${RESET}"
    else
        # A goalless draw is noise next to the branch name: the score shows once someone scored
        score=""
        [[ -n "$default" ]] && score=$(git -C "$cwd" rev-list --left-right --count "${default}...HEAD" 2>/dev/null | awk '$1+$2 > 0 {print $2 ":" $1}')
        out+="  ${KIT_AWAY}В ГОСТЯХ${score:+ $score} · ${branch}${RESET}"
    fi
fi

# Effort is a model setting, so it shares the model's bracket; the output style
# gets its own so it cannot read as a property of the model.
model_label="$model"
[[ -n "$effort" ]] && model_label+=" | ${effort}"
[[ -n "$model_label" ]] && out+="  ${MODEL}[${model_label}]${RESET}"
[[ -n "$style" && "$style" != "default" ]] && out+=" ${STYLE}[${style}]${RESET}"

echo -e "$out"

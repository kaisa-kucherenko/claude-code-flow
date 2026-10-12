#!/bin/bash
# Witcher status line: the project is a place on the map (❖), the branch the
# sword drawn for it: silver for the default branch, where the monsters live,
# steel for a working branch. Then [model | effort] and the output style.
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
GOLD='\033[38;5;179m'    # old gold: the map marker
STEEL='\033[38;5;109m'   # steel sword: cool grey-blue, apart from the dim path and the model
SILVER='\033[38;5;251m'  # silver sword
MODEL='\033[38;5;110m'
STYLE='\033[38;5;140m'
RESET='\033[0m'

out="${GOLD}❖${RESET} ${DIM}${venv}${display_path}${RESET}"
if [[ -n "$branch" ]]; then
    default=$(git -C "$cwd" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null)
    if [[ -z "$default" ]]; then
        for b in main master; do
            git -C "$cwd" rev-parse -q --verify "refs/heads/$b" > /dev/null && { default=$b; break; }
        done
    fi
    if [[ "$branch" == "${default#origin/}" ]]; then
        out+="  ${SILVER}⚔ СРІБЛО · ${branch}${RESET}"
    else
        out+="  ${STEEL}⚔ СТАЛЬ · ${branch}${RESET}"
    fi
fi

# Effort is a model setting, so it shares the model's bracket; the output style
# gets its own so it cannot read as a property of the model.
model_label="$model"
[[ -n "$effort" ]] && model_label+=" | ${effort}"
[[ -n "$model_label" ]] && out+="  ${MODEL}[${model_label}]${RESET}"
[[ -n "$style" && "$style" != "default" ]] && out+=" ${STYLE}[${style}]${RESET}"

echo -e "$out"

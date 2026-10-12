#!/usr/bin/env bash
# Rows for Claude Code's subagent panel, the agents as characters of the
# Witcher world on a job: roster name + what they are doing, the live progress
# label, elapsed time, and tokens coloured by appetite. Agents off the roster
# show their own type. Stdin: {"columns": N, "tasks": [...]} once per refresh
# tick; stdout: one {"id","content"} line per row. Needs jq.
jq -r --argjson now "$(date +%s%3N)" '
def roster: {
  "general-purpose": "Найманець на контракті", Explore: "Слідопит нюхає сліди", Plan: "Картограф креслить",
  "claude-code-guide": "Гримуар гортає", "statusline-setup": "Коваль кує",
  agatha: "Агата бачить", arthur: "Артур читає", dash: "Деш біжить",
  geralt: "Геральт на контракті", lyutik: "Лютик складає баладу",
  sam: "Сем читає лор", dean: "Дін ламає тести", kondo: "Кондо прибирає",
  gilfoyle: "Гілфойл ламає замок", lauda: "Лауда міряє", jobs: "Джобс малює",
  keeley: "Кілі пише копі", ariel: "Арієль малює схему"
};
def esc(c): "\u001b[" + c + "m";
def pad(n): . + ((" " * ([n - length, 0] | max)) // "");
def lpad(n): ((" " * ([n - length, 0] | max)) // "") + .;
def cut(n): if length > n then .[:n-1] + "…" else . end;
def tokens: if . >= 1000 then "\((. / 100 | round) / 10)k" else tostring end;
def appetite: if . > 150000 then "31" elif . > 50000 then "33" else "32" end;
def elapsed: ([($now - .) / 1000 | floor, 0] | max) as $s
  | if $s < 60 then "\($s)s" else "\($s / 60 | floor)m\($s % 60 | tostring | if length < 2 then "0" + . else . end)" end;

(.columns // 120) as $cols
| (.tasks // [])[]
| (roster[.agentType // ""] // (.agentType // .name // "агент")) as $who
| (.status == "running") as $live
| ([$cols - 48, 20] | max) as $labelw
| ($who | pad(22) | cut(22)) as $name
| ((.label // .description // "") | cut($labelw) | pad($labelw)) as $what
| ((.startTime // $now) | elapsed | lpad(5)) as $time
| ((.tokenCount // 0) | tokens) as $tok
| ((.tokenCount // 0) | appetite) as $col
| (if $live then "" else esc("2") end) as $dim
| { id: .id,
    content: ($dim + "📜 " + $name + " " + $what + "  " + $time + " · " + esc($col) + $tok + esc("0")) }
| @json
'

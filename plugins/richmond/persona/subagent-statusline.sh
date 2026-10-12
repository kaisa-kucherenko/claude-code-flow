#!/usr/bin/env bash
# Rows for Claude Code's subagent panel, the agents as the AFC Richmond squad and
# staff: roster name + a football verb, the live progress label, elapsed time,
# and tokens coloured by appetite. Agents off the roster show their own type.
# Stdin: {"columns": N, "tasks": [...]} once per refresh tick; stdout: one
# {"id","content"} line per row. Needs jq.
jq -r --argjson now "$(date +%s%3N)" '
def roster: {
  "general-purpose": "Гравець з лави", Explore: "Скаут шукає", Plan: "Тренер креслить схему",
  "claude-code-guide": "VAR перевіряє офсайд", "statusline-setup": "Технік табло",
  agatha: "Агата читає гру", arthur: "Артур розбирає тактику", dash: "Деш пресингує",
  geralt: "Геральт б\u0027є пенальті", lyutik: "Лютик веде репортаж",
  sam: "Сем дивиться повтор", dean: "Дін свистить офсайд", kondo: "Кондо розмічає поле",
  gilfoyle: "Гілфойл перевіряє квитки", lauda: "Лауда міряє спринти", jobs: "Джобс шиє форму",
  keeley: "Кілі пише прес-реліз", ariel: "Арієль малює на дошці"
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
    content: ($dim + "⚽ " + $name + " " + $what + "  " + $time + " · " + esc($col) + $tok + esc("0")) }
| @json
'

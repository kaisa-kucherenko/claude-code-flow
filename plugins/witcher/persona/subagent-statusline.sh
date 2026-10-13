#!/usr/bin/env bash
# Rows for Claude Code's subagent panel, the agents as characters of the
# Witcher world on a job: one of three lines per agent, the live progress
# label, elapsed time, and tokens coloured by appetite. Agents off the roster
# show their own type. Stdin: {"columns": N, "tasks": [...]} once per refresh
# tick; stdout: one {"id","content"} line per row. Needs jq.
jq -r --argjson now "$(date +%s%3N)" '
def roster: {
  "general-purpose": ["Найманець за крони", "Найманець на контракті", "Відьмак читає дошку"],
  Explore: ["Відьмацьке чуття", "Слідопит іде по сліду", "Медальйон тремтить"],
  Plan: ["Весемір креслить", "Весемір: спершу думай", "Дійкстра плете інтригу"],
  "claude-code-guide": ["Бібліотека Оксенфурта", "Гортає гримуар", "Бестіарій відкрито"],
  "statusline-setup": ["Краснолюд кує руни", "Коваль із Махакаму", "Рунописець за роботою"],
  agatha: ["Агата медитує", "Агата читає знаки", "Агата розвіює ілюзію"],
  arthur: ["Артур у мегаскопі", "Артур телепортувався", "Артур, гість з Офіру"],
  dash: ["Деш на Плітці", "Деш галопом", "Деш скаче напрямки"],
  geralt: ["Ґеральт на контракті", "Ґеральт точить срібло", "Ґеральт бурчить „хм“"],
  lyutik: ["Лютик складає баладу", "Лютик настроює лютню", "Лютик співає в корчмі"],
  sam: ["Сем читає бестіарій", "Сем ставить пастки", "Сем записує прикмети"],
  dean: ["Дін кусає монету", "Дін б\u0027є по слабкому", "Дін перевіряє срібло"],
  kondo: ["Кондо веде реєстр", "Кондо лічить скарбницю", "Кондо розкладає зілля"],
  gilfoyle: ["Гілфойл ставить Ірден", "Гілфойл ламає замок", "Гілфойл нюхає отруту"],
  lauda: ["Лауда п\u0027є Грім", "Лауда міряє галоп", "Лауда на перегонах"],
  jobs: ["Джобс шиє дублет", "Джобс малює герб", "Джобс обирає барви"],
  keeley: ["Кілі пише оголошення", "Кілі пускає чутки", "Кілі продає еліксири"],
  ariel: ["Арієль креслить мапу", "Арієль малює схему", "Арієль, морська діва"]
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
| roster[.agentType // ""] as $lines
# The task id picks the line, so one task keeps its line across refresh ticks
# while different tasks of the same agent read differently.
| (if $lines then $lines[(.id // "" | explode | add // 0) % ($lines | length)]
   else .agentType // .name // "агент" end) as $who
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

#!/usr/bin/env bash
# Rows for Claude Code's subagent panel, the agents as the AFC Richmond squad and
# staff: one of three football lines per agent, the live progress label, elapsed time,
# and tokens coloured by appetite. Agents off the roster show their own type.
# Stdin: {"columns": N, "tasks": [...]} once per refresh tick; stdout: one
# {"id","content"} line per row. Needs jq.
jq -r --argjson now "$(date +%s%3N)" '
def roster: {
  "general-purpose": ["Гравець з лави", "Запасний на полі", "Гравець-універсал"],
  Explore: ["Скаут на трибунах", "Скаут дивиться матч", "Скаут шукає таланти"],
  Plan: ["Бірд креслить схему", "Бірд пересуває фішки", "Бірд гортає блокнот"],
  "claude-code-guide": ["VAR дивиться повтор", "VAR перевіряє офсайд", "Суддя гортає правила"],
  "statusline-setup": ["Технік ладнає табло", "Кіт-мен клеїть номер", "Технік табло"],
  agatha: ["Агата читає гру", "Агата розбирає матч", "Агата бачить простір"],
  arthur: ["Артур-легіонер", "Артур на перегляді", "Артур з іншої ліги"],
  dash: ["Деш пресингує", "Деш у контратаці", "Деш на фланзі"],
  geralt: ["Геральт б\u0027є пенальті", "Геральт у штрафному", "Геральт тягне захист"],
  lyutik: ["Лютик веде репортаж", "Лютик співає з трибун", "Лютик на камеру"],
  sam: ["Сем ставить стінку", "Сем б\u0027є по воротах", "Сем дивиться повтор"],
  dean: ["Дін показує жовту", "Дін показує червону", "Дін свистить офсайд"],
  kondo: ["Кондо розмічає поле", "Кондо веде статистику", "Кондо складає склад"],
  gilfoyle: ["Стюард Гілфойл", "Гілфойл шукає фаєри", "Гілфойл на вході"],
  lauda: ["Лауда міряє спринти", "Лауда засікає секунди", "Лауда на GPS-трекері"],
  jobs: ["Джобс шиє форму", "Джобс малює герб", "Джобс обирає кольори"],
  keeley: ["Кілі пише прес-реліз", "Кілі веде соцмережі", "Кілі продає бренд"],
  ariel: ["Арієль малює на дошці", "Арієль малює стрілки", "Арієль малює схему"]
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
    content: ($dim + "⚽ " + $name + " " + $what + "  " + $time + " · " + esc($col) + $tok + esc("0")) }
| @json
'

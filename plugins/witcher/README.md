# witcher — The Witcher 3 persona for Claude Code

Claude Code dressed as *The Witcher 3*: the game's vitality, stamina and
toxicity bars above the prompt, Geralt's lines when an answer is ready, two
themes (Corvo Bianco and Kaer Morhen), campfire spinner lines and a status
line where `main` takes the silver sword.

All the texts (HUD, spinner verbs, tips, status line, subagent panel) are in
**Ukrainian**.

## Requirements

- **Linux.** Built and tested on Ubuntu 22.04 with GNOME Terminal 3.44 and
  Claude Code 2.1.296. The HUD needs Claude Code 2.1.287 or later (mods on by default).
- `jq` for `/witcher`, the status lines and the sounds (`sudo apt install jq`).
- Sounds play through `paplay` (PulseAudio or PipeWire, default on Ubuntu).
  Without it the plugin stays silent.
- The break timer (`/timer`) needs systemd's user manager (`systemd-run --user`)
  and, for its break screen, an X11 session (Wayland works through XWayland) and
  GTK 3 with PyGObject under `/usr/bin/python3`: `sudo apt install python3-gi python3-gi-cairo`
  if they are missing.
- The terminal profile is for GNOME Terminal. Where it isn't installed,
  `/witcher` skips it. The colours are in `persona/terminal/*.dconf`, so you can
  copy them into your own terminal.

## Install

```
claude plugin marketplace add kaisa-kucherenko/claude-code-flow
claude plugin install witcher@claude-code-flow
```

Then, inside Claude Code:

```
/witcher                   # Corvo Bianco: warm wood and gold
/witcher kaer-morhen       # Kaer Morhen: cold stone and gold
```

Restart Claude Code (`/exit`, then `claude -c`) and you're on the Path.

## What you get

| Part | Comes with | What it shows |
|------|-----------|---------------|
| HUD above the prompt | the plugin | Toxicity is the context % and carries a mark at 30 %, the point to hand the session off; `/config witcher.toxicityThreshold=40` moves it to your own. Stamina is the 5-hour limit and vitality the 7-day limit, both draining like the game's bars. |
| Sounds | the plugin | The level-up chime when an answer is ready, «Something to think about» the moment Claude asks for a permission or a question. Each moment takes any clip of the set; see below. |
| Themes | the plugin | Corvo Bianco and Kaer Morhen, listed in `/theme`. |
| Spinner verbs and tips | `/witcher` | 55 verbs and 76 tips: lines from the books and in the characters' voices. A long turn moves to the next verb every 30 s; `/config witcher.spinnerSeconds=60` makes it 60. |
| Status line | `/witcher` | `❖ project  ⚔ СРІБЛО · main  [model \| effort]`. A working branch takes the steel sword. |
| Subagent panel | `/witcher` | Agents on a contract, three lines each: Explore follows its witcher senses, Plan is Vesemir at the map, a general-purpose agent a hired sword. |
| Terminal profile | `/witcher`, GNOME Terminal | Background, palette and cursor for new tabs; your font stays. |
| Break timer | the plugin | `/timer 45m` counts down in the band and rings with a break screen; see below. |

## Sounds

Three moments have a sound, and each takes any clip from `sounds/`:

| Moment | Setting | Default |
|--------|---------|---------|
| An answer is ready, nothing left running in the background | `turnDoneSound` | `level-up` |
| Claude asks for a permission or a question | `needsYouSound` | `something-to-think-about` |
| The break timer rings | `timerDoneSound` | `lullaby-of-woe` |

Pick one in `/config` (it lists the clips), type
`/config witcher.turnDoneSound=loot`, or just tell Claude which clip you want
where. `CLAUDE_SOUND=off` mutes all three.

The clips:

| Clip | What you hear |
|------|---------------|
| `level-up` | The game's level-up chime |
| `something-to-think-about` | “There's something to think about, folks” |
| `lullaby-of-woe` | The song Lullaby of Woe |
| `you-learned-something` | “You learned something, but not everything” |
| `loot` | The game's loot pickup |
| `new-quest` | The game's new-quest sound |
| `quest-updated` | The game's quest-updated sound |
| `quest-completed` | The game's quest-completed sound |
| `geralt-soitbegins` | Geralt: “So it begins” |
| `geralt-wtf` | Geralt: “What the fuck was that?” |
| `hmm` | Geralt's “Hmm” |
| `damn-it` | “Come on, damn it” |
| `she-fixed-it` | “She fixed it” |
| `i-could-use-the-practice` | “Try me, peasant. I could use the practice” |
| `if-you-don-t-shut-up` | “And I'll take your tongue if you don't shut up” |
| `i-will-kill-you` | “Challenge me again… look at me the wrong way, and I'll kill you” |
| `lalala` | Music with a woman singing “la-la-la” |

## Break timer

`/timer 45m` (or `45`, `1h`) reminds you to take a break once that time is up.
`/timer` alone says how long is left, `/timer off` cancels it, and a new time
replaces the running one. One timer serves every open Claude Code session,
the desktop app's included; the band counts it down as «☾ Медитація через 32:10».

When it is up a break screen opens over your work, Lullaby of Woe plays (or the
clip you picked), and the band shows «☾ Час медитації» until your next prompt.
The screen carries «Час медитації», a line from `persona/breaks.json` and one
of the GIFs in `persona/breaks/`, in the Corvo Bianco colours (`screen` in the
same file). Its «Повертаюсь» button unlocks after 10 seconds, so an Enter typed
mid-sentence cannot dismiss it unseen; Esc works from then on too.

It opens as an 800×500 window in the middle of the main monitor;
`/config witcher.breakScreen=fullscreen` covers every monitor instead.
Whichever persona is on duty at that moment speaks, and a persona without a
break screen, or a screen that fails to open, rings with a GNOME banner. With no persona on, the banner says
“Time for a break” and the desktop's alarm plays; the countdown in the band
shows only while a persona is on duty. `CLAUDE_SOUND=off` mutes the clip.

The timer belongs to Claude Code, not to your desktop: when the last session
exits it is cancelled, and if none is left when it is due it stays silent.
A new `/timer` or the last session exiting also closes a break screen still open.
systemd counts the time (a transient unit, `claude-persona-timer`), so it rings
once however many sessions are open.

## Switching personas

The marketplace also has [`richmond`](../richmond/). Install both and switch
with one command: `/richmond` puts AFC Richmond on duty, `/witcher` brings the
Witcher back. The HUD, sounds, status line and spinner verbs follow within
seconds, in every open session. The theme takes one pick in `/theme` (a plugin
can't switch a custom theme in a running session), tips change from the next
session and the terminal colours from the next tab. Until you pick one, both
play their sounds and one HUD covers the other.

## What `/witcher` changes, and how to undo it

The plugin can't set your theme, spinner verbs, tips or status line itself:
those are keys in your `~/.claude/settings.json`. So `/witcher` runs `scripts/wear.sh`, which
writes them:

- `theme`, `spinnerVerbs`, `spinnerTipsOverride`, `statusLine`, `subagentStatusLine`;
- `enabledPlugins`, only if `witcher` is switched off there: it is switched back on;
- `~/.claude/personas/active`, which names the persona on duty: with several
  persona plugins installed, only that one shows its HUD and plays sounds;
- the default GNOME Terminal profile.

The first run saves the previous values of the five keys in the first line to
`~/.claude/personas/backup.json`. **`/witcher off`** puts them back and
silences the HUD and sounds of every persona plugin; they stay installed, and
`/witcher` puts the persona back on. Run it before `claude plugin uninstall`,
or the status lines keep running from their copies. Everything else in your
settings stays as it is, including whatever you changed while the persona was
on. The status line scripts are copied to `~/.claude/personas/` because the
plugin's own folder changes path with every update.

## Development

```
claude plugin validate plugins/witcher
claude plugin test plugins/witcher        # the HUD and the /witcher command
bash plugins/witcher/tests/wear.test.sh   # wear.sh against a throwaway config
bash plugins/witcher/tests/sound.test.sh  # which persona plays, and which clip
bash plugins/witcher/tests/timer.test.sh  # timer.sh with systemd, the banner and the break screen stubbed
```

## Rights

An unofficial, non-commercial fan project, made under the CD PROJEKT RED Fan
Content Guidelines. *The Witcher* and its characters belong to CD PROJEKT S.A.;
the original books are by Andrzej Sapkowski. The clips are short excerpts:
voice lines and game sounds of a few seconds, the longest 14 seconds of
Lullaby of Woe. The break-screen GIFs in `persona/breaks/` are short loops from
the game's cutscenes, taken from GIPHY and Tenor and cut down to a few seconds. If you hold the rights
and want them out, open an issue.

The break screen is set in Alegreya by Huerta Tipográfica, under the SIL Open
Font License 1.1 (`fonts/OFL.txt`); the two files are static SemiBold and
Regular instances of the variable font from Google Fonts.

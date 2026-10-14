# richmond — AFC Richmond persona for Claude Code

Claude Code dressed as AFC Richmond from *Ted Lasso*: a match HUD above the
prompt, Roy Kent's "let's go again" when an answer is ready, two Nelson Road themes,
locker-room spinner lines and a status line where `main` is a home game.

All the texts (HUD, spinner verbs, tips, status line, subagent panel) are in
**Ukrainian**.

## Requirements

- **Linux.** Built and tested on Ubuntu 22.04 with GNOME Terminal 3.44 and
  Claude Code 2.1.296. The HUD needs Claude Code 2.1.287 or later (mods on by default).
- `jq` for `/richmond`, the status lines and the sounds (`sudo apt install jq`).
- Sounds play through `paplay` (PulseAudio or PipeWire, default on Ubuntu).
  Without it the plugin stays silent.
- The break timer (`/timer`) needs systemd's user manager (`systemd-run --user`)
  and, for its break screen, an X11 session (Wayland works through XWayland) and
  GTK 3 with PyGObject under `/usr/bin/python3`: `sudo apt install python3-gi python3-gi-cairo`
  if they are missing.
- The terminal profile is for GNOME Terminal. Where it isn't installed,
  `/richmond` skips it. The colours are in `persona/terminal/*.dconf`, so you can
  copy them into your own terminal.

## Install

```
claude plugin marketplace add kaisa-kucherenko/claude-code-flow
claude plugin install richmond@claude-code-flow
```

Then, inside Claude Code:

```
/richmond                  # Nelson Road: navy and gold
/richmond diamond-dogs     # Diamond Dogs: graphite and blue
```

Restart Claude Code (`/exit`, then `claude -c`) and you're on the pitch.

## What you get

| Part | Comes with | What it shows |
|------|-----------|---------------|
| HUD above the prompt | the plugin | The session as a match: context % is the match clock (1st half → 2nd half → extra time at 30 %, the point to hand the session off → penalties from 40 %); `/config richmond.toxicityThreshold=40` moves extra time to your own, and penalties follow 10 points later. Five balls for the 5-hour limit, the BELIEVE sign for the 7-day limit, one letter per day. |
| Sounds | the plugin | Roy's "All right, let's go again!" when an answer is ready, Roy swearing the moment Claude asks for a permission or a question. Each moment takes any clip of the set; see below. |
| Themes | the plugin | Nelson Road and Diamond Dogs, listed in `/theme`. |
| Spinner verbs and tips | `/richmond` | 60 verbs and 77 tips in the characters' voices. A long turn moves to the next verb every 30 s; `/config richmond.spinnerSeconds=60` makes it 60. |
| Status line | `/richmond` | `⚑ project  ВДОМА · main  [model \| effort]`. A working branch is an away game, and its score is commits ahead : behind. |
| Subagent panel | `/richmond` | Agents as the squad and staff, three lines each: Explore is the scout, Plan is Beard at the whiteboard. |
| Terminal profile | `/richmond`, GNOME Terminal | Background, palette and cursor for new tabs; your font stays. |
| Break timer | the plugin | `/timer 45m` counts down in the band and rings with a break screen; see below. |

## Sounds

Three moments have a sound, and each takes any clip from `sounds/`:

| Moment | Setting | Default |
|--------|---------|---------|
| An answer is ready, nothing left running in the background | `turnDoneSound` | `roy-lets-go-again` |
| Claude asks for a permission or a question | `needsYouSound` | `roy-fuck-no` |
| The break timer rings | `timerDoneSound` | `ted-enough-for-today` |

Pick one in `/config` (it lists the clips), type
`/config richmond.turnDoneSound=keeley-well-done`, or just tell Claude which clip you want
where. `CLAUDE_SOUND=off` mutes all three.

The clips:

| Clip | What you hear |
|------|---------------|
| `roy-lets-go-again` | Roy: “All right, let's go again” |
| `roy-fuck-no` | Roy: “Fuck no!” |
| `ted-enough-for-today` | Ted: “I think that's enough for today”, then Roy whistles the team in |
| `roy-okay-were-done` | Roy: “Okay, we're done” |
| `roy-whistle` | Roy's whistle |
| `roy-kent-chant` | The crowd: “Roy Kent! He's here, he's there…” |
| `keeley-well-done` | Keeley: “Well done” |
| `dani-football-is-life` | Dani before his penalty: “Football is life” |
| `dani-football-is-death` | Dani: “Football is death!” |
| `na-na-dani-rojas` | “Na-na-na…”, then “Dani Rojas” as he rejoins the team |
| `jamie-tartt-chant` | The pub sings “Jamie Tartt, ta-da-da-da-da” |
| `bonfire-richmond-till-we-die` | The team at the bonfire: “Richmond till we die” |
| `so-long-farewell-v1` | The team's farewell song to Ted, the opening |
| `so-long-farewell-v2` | The farewell song, “the sun has gone to bed” |

## Break timer

`/timer 45m` (or `45`, `1h`) reminds you to take a break once that time is up.
`/timer` alone says how long is left, `/timer off` cancels it, and a new time
replaces the running one. One timer serves every open Claude Code session,
the desktop app's included; the band counts it down as «◷ Тайм-аут через 32:10».

When it is up a break screen opens over your work, Ted calls practice while Roy
whistles the team in (or the clip you picked), and the band shows «◷ Тайм-аут»
until your next prompt. The screen carries «ТАЙМ-АУТ», a line from
`persona/breaks.json` and one of the GIFs in `persona/breaks/`, in the Nelson Road
navy and gold (`screen` in the same file). Its «Назад на поле» button unlocks
after 10 seconds, so an Enter typed mid-sentence cannot dismiss it unseen; Esc
works from then on too.

It opens as an 800×520 window in the middle of the main monitor;
`/config richmond.breakScreen=fullscreen` covers every monitor instead.
Whichever persona is on duty at that moment speaks, and a persona without a
break screen, or a screen that fails to open, rings with a GNOME banner. With no
persona on, the banner says “Time for a break” and the desktop's alarm plays;
the countdown in the band shows only while a persona is on duty.
`CLAUDE_SOUND=off` mutes the clip.

The timer belongs to Claude Code, not to your desktop: when the last session
exits it is cancelled, and if none is left when it is due it stays silent.
A new `/timer` or the last session exiting also closes a break screen still open.
systemd counts the time (a transient unit, `claude-persona-timer`), so it rings
once however many sessions are open.

## Switching personas

The marketplace also has [`witcher`](../witcher/). Install both and switch with
one command: `/witcher` puts the Witcher on duty, `/richmond` brings Richmond
back. The HUD, sounds, status line and spinner verbs follow within seconds, in
every open session. The theme takes one pick in `/theme` (a plugin can't switch
a custom theme in a running session), tips change from the next session and the
terminal colours from the next tab. Until you pick one, both play their sounds
and one HUD covers the other.

## What `/richmond` changes, and how to undo it

The plugin can't set your theme, spinner verbs, tips or status line itself:
those are keys in your `~/.claude/settings.json`. So `/richmond` runs `scripts/wear.sh`, which
writes them:

- `theme`, `spinnerVerbs`, `spinnerTipsOverride`, `statusLine`, `subagentStatusLine`;
- `enabledPlugins`, only if `richmond` is switched off there: it is switched back on;
- `~/.claude/personas/active`, which names the persona on duty: with several
  persona plugins installed, only that one shows its HUD and plays sounds;
- the default GNOME Terminal profile.

The first run saves the previous values of the five keys in the first line to
`~/.claude/personas/backup.json`. **`/richmond off`** puts them back and
silences the HUD and sounds of every persona plugin; they stay installed, and
`/richmond` puts the persona back on. Run it before `claude plugin uninstall`,
or the status lines keep running from their copies. Everything else in your
settings stays as it is, including whatever you changed while the persona was
on. The status line scripts are copied to `~/.claude/personas/` because the
plugin's own folder changes path with every update.

## Development

```
claude plugin validate plugins/richmond
claude plugin test plugins/richmond        # the HUD and the /richmond command
bash plugins/richmond/tests/wear.test.sh   # wear.sh against a throwaway config
bash plugins/richmond/tests/sound.test.sh  # which persona plays, and which clip
bash plugins/richmond/tests/timer.test.sh  # timer.sh with systemd, the banner and the break screen stubbed
```

## Rights

An unofficial, non-commercial fan project. *Ted Lasso*, AFC Richmond and their
characters belong to their rights holders (Apple TV+, Warner Bros. Television).
The clips are short excerpts: lines of a second or two, and chants and songs of
up to 18 seconds. The break-screen GIFs in `persona/breaks/` are short loops of
scenes from the series, taken from Tenor. If you hold the rights and want them
out, open an issue.

The break screen is set in Fira Sans and Fira Sans Extra Condensed by the
Mozilla Foundation and Telefonica S.A., under the SIL Open Font License 1.1
(`fonts/OFL.txt`); the three files are the unmodified static fonts from Google Fonts.

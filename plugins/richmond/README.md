# richmond — AFC Richmond persona for Claude Code

Claude Code dressed as AFC Richmond from *Ted Lasso*: a match HUD above the
prompt, Roy Kent's "let's go again" when an answer is ready, two Nelson Road themes,
locker-room spinner lines and a status line where `main` is a home game.

All the texts (HUD, spinner verbs, tips, status line, subagent panel) are in
**Ukrainian**.

## Requirements

- **Linux.** Built and tested on Ubuntu 22.04 with GNOME Terminal 3.44 and
  Claude Code 2.1.296. The HUD needs Claude Code 2.1.287 or later (mods on by default).
- `jq` for `/richmond` and the status lines (`sudo apt install jq`).
- Sounds play through `paplay` (PulseAudio or PipeWire, default on Ubuntu).
  Without it the plugin stays silent.
- The break timer (`/timer`) needs systemd's user manager (`systemd-run --user`)
  and `notify-send` for the banner; both ship with Ubuntu's desktop.
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
| HUD above the prompt | the plugin | The session as a match: context % is the match clock (1st half → 2nd half → extra time at 30 % → penalties from 40 %). Five balls for the 5-hour limit, the BELIEVE sign for the 7-day limit, one letter per day. |
| Sounds | the plugin | Roy's "All right, let's go again!" when an answer is ready, Roy swearing the moment Claude asks for a permission or a question. `CLAUDE_SOUND=off` mutes both. |
| Themes | the plugin | Nelson Road and Diamond Dogs, listed in `/theme`. |
| Spinner verbs and tips | `/richmond` | 60 verbs and 95 tips in the characters' voices. A long turn moves to the next verb every 30 s; `/config richmond.spinnerSeconds=60` makes it 60. |
| Status line | `/richmond` | `⚑ project  ВДОМА · main  [model \| effort]`. A working branch is an away game, and its score is commits ahead : behind. |
| Subagent panel | `/richmond` | Agents as the squad and staff: Explore is the scout, Plan is the coach at the whiteboard. |
| Terminal profile | `/richmond`, GNOME Terminal | Background, palette and cursor for new tabs; your font stays. |
| Break timer | the plugin | `/timer 45m` counts down in the band and rings with a banner; see below. |

## Break timer

`/timer 45m` (or `45`, `1h`) reminds you to take a break once that time is up.
`/timer` alone says how long is left, `/timer off` cancels it, and a new time
replaces the running one. One timer serves every open Claude Code session,
the desktop app's included; the band counts it down as «◷ Тайм-аут через 32:10».

When it is up you get a GNOME banner and a clip, and the band shows «◷ Тайм-аут»
until your next prompt. Whichever persona is on duty at that moment speaks:
Richmond titles the banner «Тайм-аут» with a line from `persona/breaks.json`,
and Ted calls practice while Roy whistles the team in. With no persona on, the
banner says “Time for a break” and the desktop's alarm plays; the countdown in
the band shows only while a persona is on duty. `CLAUDE_SOUND=off` keeps the
banner and mutes the clip.

The timer belongs to Claude Code, not to your desktop: when the last session
exits it is cancelled, and if none is left when it is due it stays silent.
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
bash plugins/richmond/tests/sound.test.sh  # which persona gets to play
bash plugins/richmond/tests/timer.test.sh  # timer.sh with systemd and the banner stubbed
```

## Rights

An unofficial, non-commercial fan project. *Ted Lasso*, AFC Richmond and their
characters belong to their rights holders (Apple TV+, Warner Bros. Television).
The two event clips are under three seconds each; the break timer plays a
16-second scene from season 3. If you hold the rights and want them out, open
an issue.

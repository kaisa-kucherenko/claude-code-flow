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
- `jq` for `/witcher` and the status lines (`sudo apt install jq`).
- Sounds play through `paplay` (PulseAudio or PipeWire, default on Ubuntu).
  Without it the plugin stays silent.
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
| HUD above the prompt | the plugin | Toxicity is the context % and carries a mark at 30 %, the point to hand the session off. Stamina is the 5-hour limit and vitality the 7-day limit, both draining like the game's bars. |
| Sounds | the plugin | «You learned something» when an answer is ready, «Something to think about» the moment Claude asks for a permission or a question. `CLAUDE_SOUND=off` mutes both. |
| Themes | the plugin | Corvo Bianco and Kaer Morhen, listed in `/theme`. |
| Spinner verbs and tips | `/witcher` | 55 verbs and 90 tips: lines from the books and in the characters' voices. |
| Status line | `/witcher` | `❖ project  ⚔ СРІБЛО · main  [model \| effort]`. A working branch takes the steel sword. |
| Subagent panel | `/witcher` | Agents on a contract: Explore is the tracker, Plan the cartographer, a general-purpose agent a hired sword. |
| Terminal profile | `/witcher`, GNOME Terminal | Background, palette and cursor for new tabs; your font stays. |

## Switching personas

The marketplace also has [`richmond`](../richmond/). Install both and switch with
one command and a restart: `/richmond` puts AFC Richmond on duty, `/witcher`
brings the Witcher back. Until you pick one, both play their sounds and one HUD
covers the other.

## What `/witcher` changes, and how to undo it

The plugin can't set your theme, spinner or status line itself: those are keys
in your `~/.claude/settings.json`. So `/witcher` runs `scripts/wear.sh`, which
writes them:

- `theme`, `spinnerVerbs`, `spinnerTipsOverride`, `statusLine`, `subagentStatusLine`;
- `~/.claude/personas/active`, which names the persona on duty: with several
  persona plugins installed, only that one shows its HUD and plays sounds;
- the default GNOME Terminal profile.

The first run saves the previous values of exactly those keys to
`~/.claude/personas/backup.json`. **`/witcher off`** puts them back and
silences the HUD and sounds of every persona plugin; they stay installed, and
`/witcher` puts the persona back on. Run it before `claude plugin uninstall`,
or the status lines keep running from their copies. Everything else in your
settings stays as it is, including whatever you changed while the persona was on. The status line
scripts are copied to `~/.claude/personas/` because the plugin's own folder
changes path with every update.

## Development

```
claude plugin validate plugins/witcher
claude plugin test plugins/witcher        # the HUD and the /witcher command
bash plugins/witcher/tests/wear.test.sh   # wear.sh against a throwaway config
bash plugins/witcher/tests/sound.test.sh  # which persona gets to play
```

## Rights

An unofficial, non-commercial fan project, made under the CD PROJEKT RED Fan
Content Guidelines. *The Witcher* and its characters belong to CD PROJEKT S.A.;
the original books are by Andrzej Sapkowski. The two voice clips are under
three seconds each. If you hold the rights and want them out, open an issue.

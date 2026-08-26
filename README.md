# claude-code-flow

My working Claude Code setup — the output style and hooks I use daily as a
tech lead doing AI-heavy development. Published as-is from my own `~/.claude`,
sanitized of project specifics.

The problem all of this attacks: **cognitive load**. When AI writes the code,
you spend the whole day reading, verifying, and deciding — and the model's
default verbosity makes every one of those decisions more expensive. These
files are how I fight that.

Some files mix English instructions with Ukrainian examples — I work
bilingually. The mechanics are language-agnostic; adapt the examples to
yourself.

## What's here

| Component | What it does |
|-----------|--------------|
| [`output-styles/RoyKent.md`](output-styles/RoyKent.md) | My main output style: BLUF, hard cut-pass procedure, no closing summaries, colleague-not-assistant. Roy Kent from Ted Lasso as the persona. |
| [`hooks/style-reinject.sh`](hooks/style-reinject.sh) | Fights persona drift on long contexts: re-injects a short style reminder into every prompt. Generic — works with any style that has a reminder file. |
| [`hooks/style-reminders/`](hooks/style-reminders/) | The per-style reminder texts the hook injects. |
| [`skills/handoff/`](skills/handoff/SKILL.md) | Session handoff: writes the task state into a file before context quality degrades. Writer-controlled alternative to `/compact` — you decide what survives, not the summarizer. |
| [`skills/pickup/`](skills/pickup/SKILL.md) | Counterpart: a fresh session finds the handoff, verifies it against reality (git, files), and continues from the NEXT step. |
| [`statusline/statusline.sh`](statusline/statusline.sh) | Status line with the number that drives my whole workflow: context % with traffic-light colors (green <30, yellow 30–40, red above), plus model/style, git branch, and rate-limit windows. |
| [`agents/`](agents/) | The team: implementers (Geralt — backend, Lyutik — frontend), the review panel (Agatha / Arthur / Dash — three models, one diff), and specialists (Jobs — UI/UX, Lauda — performance, Gilfoyle — security). |

## Install

### Output style

```bash
mkdir -p ~/.claude/output-styles
cp output-styles/RoyKent.md ~/.claude/output-styles/
```

Activate it either way:

- in Claude Code: `/output-style` → pick **Roy Kent**, or
- in `~/.claude/settings.json`: `"outputStyle": "Roy Kent"` (how I set it).

The style applies to new sessions — restart or `/clear` to see it.

### Persona re-inject hook

The style alone degrades on long sessions — the model slides back to default
behavior. The hook re-anchors it on every message for a few hundred tokens —
cheap next to what drift costs.

```bash
mkdir -p ~/.claude/hooks
cp hooks/style-reinject.sh ~/.claude/hooks/
cp -r hooks/style-reminders ~/.claude/
```

Register it in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "bash ~/.claude/hooks/style-reinject.sh" }
        ]
      }
    ]
  }
}
```

How it works: on every prompt the hook resolves the active `outputStyle` from
settings (best-effort: local project → project → user precedence) and prints
`~/.claude/style-reminders/<style>.txt` to stdout, which Claude Code adds to
context. A style without a reminder file injects nothing, so the hook is safe
to keep enabled globally. `jq` is recommended for robust settings parsing;
without it the hook falls back to `sed`.

Writing your own reminder: don't copy the whole style — distill the 5–7 rules
the model actually violates when it drifts. Mine is the cut-pass checklist plus
the persona line.

### Handoff / pickup skills

Why not `/compact`: it decides for you what survives the context switch, and you
find out what it kept only in the next session. A handoff file is deliberate —
task state, what's done, what's ruled out and why, and the exact next step.

```bash
mkdir -p ~/.claude/skills
cp -r skills/handoff skills/pickup ~/.claude/skills/
```

Usage: work until context quality starts to degrade → `/handoff` (writes/updates
`HANDOFF_<slug>.md` in the project root, kept out of git via `.git/info/exclude`)
→ `/clear` or new session → `/pickup`. The pickup verifies the file against git
and reality before acting — a handoff is a snapshot, not gospel.

### Status line

Puts the context-usage percentage permanently in front of you. Watching this
number is how I found my working rule: quality is sharp below ~30% of the
context window, degrades noticeably after — so the thresholds are green <30%,
yellow 30–40% (time to `/handoff`), red above. Not a benchmark, an observation —
but a stubbornly repeatable one. Also shows model + active style, git branch,
and Pro/Max rate-limit windows with reset time.

```bash
cp statusline/statusline.sh ~/.claude/
chmod +x ~/.claude/statusline.sh
```

Register it in `~/.claude/settings.json`:

```json
{
  "statusLine": { "type": "command", "command": "~/.claude/statusline.sh" }
}
```

Parses the status JSON with `jq` when present, falls back to `python3`. Runs in
~20ms — it never slows the session down.

### Agents

```bash
mkdir -p ~/.claude/agents
cp agents/*.md ~/.claude/agents/
```

Named after characters from shows I like — that's how I remember who does what,
and it makes the day more fun. The pattern matters more than the names: a
narrowly-focused agent with a project-tuned prompt beats a general session at
its specialty, and the main session stays an orchestrator — it hands out work
and checks results against the spec instead of burning its own context on
implementation.

**Implementers** — the main session doesn't write code, these do:

- **Geralt** (backend) — modern Python, async discipline, does the dirty work
  quietly and shows test output as proof.
- **Lyutik** (frontend) — React/Next/TypeScript, and explains WHY at every
  decision so a backend-leaning owner learns instead of just pasting. Geralt
  works in silence; Lyutik makes it look good and talks about it. Naturally.

**Review panel** — three reviewers, same diff, different eyes:

- **Agatha** (Claude Opus) — deep architectural review, reads everything.
- **Arthur** (wrapper around the Codex CLI — requires it installed) — the
  cross-vendor second opinion; different model families genuinely find
  different bugs in the same code.
- **Dash** (Claude Sonnet) — the fast, sharp third lens.

All three share two hard rules baked into their prompts: the caller gives them
only the spec and the code (no "we already fixed X" — it biases the review),
and a re-review runs with a byte-identical prompt (priming a reviewer with
"verify our fixes" is how bugs get waved through).

**Specialists** — for questions where a general session answers shallowly:

- **Jobs** — UI/UX: design tokens, component specs, accessibility.
- **Lauda** — performance: N+1s, async misuse, LLM token waste.
- **Gilfoyle** — security: thinks like an attacker, reports like an engineer.

One agent is deliberately missing: my product-marketing agent is so tuned to
its project (real funnel tables, real data caveats) that publishing it would
be pointless — which is exactly the argument for writing your own instead of
collecting generic ones.

## License

MIT

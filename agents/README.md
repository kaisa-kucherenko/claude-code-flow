# Agents

Named after characters from shows I like — that's how I remember who does
what, and it makes the day more fun. The pattern matters more than the names:
a narrowly-focused agent with a tuned prompt beats a general session at its
specialty, and the main session stays an **orchestrator** — it hands out work
and checks results against the spec instead of burning its own context on
implementation.

## Install

```bash
mkdir -p ~/.claude/agents
cp agents/{agatha,arthur,dash,geralt,gilfoyle,jobs,lauda,lyutik}.md ~/.claude/agents/
```

Arthur additionally needs the [Codex CLI](https://github.com/openai/codex)
installed and configured (`~/.codex/config.toml` picks the model); to run him
without a permission prompt each time, allow `Bash(codex exec:*)` in your
Claude Code permissions.

## Implementers — the main session doesn't write code, these do

| Agent | Lane |
|-------|------|
| [`geralt.md`](geralt.md) | Backend: modern Python 3.11+, async discipline, parametrized SQL. Does the dirty work quietly and shows test output as proof. |
| [`lyutik.md`](lyutik.md) | Frontend: React/Next/TypeScript — and explains WHY at every decision, so a backend-leaning owner learns instead of just pasting. |

Geralt works in silence; Lyutik makes it look good and talks about it.
Naturally.

## Review panel — three reviewers, same diff, different eyes

| Agent | Lens |
|-------|------|
| [`agatha.md`](agatha.md) | Deep architectural review (Claude Opus) — reads everything, pulls every thread. |
| [`arthur.md`](arthur.md) | Wrapper around the **Codex CLI** (requires it installed) — the cross-vendor second opinion. Different model families genuinely find different bugs in the same code. |
| [`dash.md`](dash.md) | The fast, sharp third lens (Claude Sonnet) — diff-first, straight at what breaks. |

The three prompt files are deliberately different in shape — Agatha is written
as an identity ("what meticulousness means to you"), Dash as a terse process,
Arthur as a CLI protocol — because depth, speed, and wrapping are different
jobs. What IS uniform is what must merge: a shared severity scale
(BLOCKING / IMPORTANT / NIT, exact labels) and two rules — a caller convention,
with the reviewer prompts written to enforce it even when the caller slips:

1. **The briefing is neutral: spec, code, context — never "we already fixed X".**
   It points the review down a corridor and blinds it to everything else; the
   prompts explicitly refuse that frame.
2. **A re-review is a fresh review with the same neutral briefing** — no
   "verify our fixes". Priming a reviewer toward confirmation is how bugs get
   waved through; the prompts treat it as a signal to read with extra
   independence.

The panel is orchestrated by [`../workflows/precogs.js`](../workflows/precogs.js)
— parallel run, then a synthesis agent that dedupes and cross-votes the
findings.

## Specialists — for questions a general session answers shallowly

| Agent | Lane |
|-------|------|
| [`jobs.md`](jobs.md) | UI/UX: design tokens, component specs, accessibility baked in from the token layer. |
| [`lauda.md`](lauda.md) | Performance: N+1s, async misuse, LLM token waste, cold starts. Measures, never guesses. |
| [`gilfoyle.md`](gilfoyle.md) | Security: thinks like an attacker, reports like an engineer. |

One agent is deliberately missing: my product-marketing agent is so tuned to
its project (real funnel tables, real data caveats) that publishing it would
be pointless — which is exactly the argument for writing your own instead of
collecting generic ones.

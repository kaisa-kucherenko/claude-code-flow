# Output styles

The problem this attacks: model verbosity is cognitive load. You ask "yes or
no?" and get three screens with a plan, a summary, and well-wishes — and you
have to read all of it to fish out the answer. An output style is your own
system-prompt layer that rewrites the default behavior.

## Roy Kent

[`RoyKent.md`](RoyKent.md) — my main style: BLUF (verdict in sentence one), a
hard cut-pass procedure run before every reply, no closing summaries, no
sycophancy, colleague-not-assistant. Roy Kent from Ted Lasso as the persona:
direct, serious, says it as it is.

The file mixes English rules with Ukrainian examples because I work
bilingually — the mechanics are language-agnostic; adapt the examples.

## Install

```bash
mkdir -p ~/.claude/output-styles
cp output-styles/RoyKent.md ~/.claude/output-styles/
```

Activate it either way:

- in Claude Code: `/config` → **Output style** → pick **Roy Kent**, or
- in `~/.claude/settings.json`: `"outputStyle": "Roy Kent"` (how I set it).

The style applies to new sessions — restart or `/clear` to see it.

## Known limitation — and the fix

A style alone degrades on long sessions: the model gradually slides back to
default behavior. The fix is the re-inject hook in [`../hooks/`](../hooks/) —
it re-anchors the persona on every message. Install both; the style without
the hook is half the tool.

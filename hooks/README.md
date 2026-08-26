# Hooks

## style-reinject.sh — fighting persona drift

An output style is injected once, at session start. On a long context the
model drifts back to its default voice — the persona dissolves exactly when
you need it most. This `UserPromptSubmit` hook re-injects a short style
reminder into every prompt: a few hundred tokens per message, cheap next to
what drift costs.

(Claude Code's own built-in concise style ships with the same trick — a
per-prompt reminder — so the pattern is vendor-approved.)

## Install

```bash
mkdir -p ~/.claude/hooks
cp style-reinject.sh ~/.claude/hooks/
cp -r style-reminders ~/.claude/
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

## How it works

On every prompt the hook resolves the active `outputStyle` from settings
(best-effort: local project → project → user precedence) and prints
`~/.claude/style-reminders/<style>.txt` to stdout, which Claude Code adds to
context. A style without a reminder file injects nothing, so the hook is safe
to keep enabled globally. `jq` is recommended for robust settings parsing;
without it the hook falls back to `sed`.

## Writing your own reminder

Don't copy the whole style — distill the 5–7 rules the model actually violates
when it drifts. Mine ([`style-reminders/Roy Kent.txt`](style-reminders/Roy%20Kent.txt))
is the cut-pass checklist plus the persona line.

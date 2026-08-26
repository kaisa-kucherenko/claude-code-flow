# claude-code-flow

My working Claude Code setup — the output style, hooks, skills, and agents I
use daily as a tech lead doing AI-heavy development. Published as-is from my
own `~/.claude`, sanitized of project specifics.

The problem all of this attacks: **cognitive load**. When AI writes the code,
you spend the whole day reading, verifying, and deciding — and the model's
default verbosity makes every one of those decisions more expensive. These
files are how I fight that.

Some files mix English instructions with Ukrainian examples — I work
bilingually. The mechanics are language-agnostic; adapt the examples to
yourself.

## What's here

| Component | What it does | Docs |
|-----------|--------------|------|
| Output style | BLUF, hard cut-pass, no closing summaries, colleague-not-assistant. Roy Kent from Ted Lasso as the persona. | [`output-styles/`](output-styles/) |
| Persona re-inject hook | Fights persona drift on long contexts: re-injects a short style reminder into every prompt. | [`hooks/`](hooks/) |
| Handoff / pickup skills | Deliberate session switching instead of `/compact`: you decide what survives, the next session verifies it against reality. | [`skills/`](skills/) |
| Status line | The context-% number that drives the whole workflow, with traffic-light thresholds (green <30%, yellow 30–39%, red at 40+). | [`statusline/`](statusline/) |
| Agents | Implementers (Geralt/Lyutik), a three-model review panel (Agatha/Arthur/Dash), specialists (Jobs/Lauda/Gilfoyle). | [`agents/`](agents/) |
| Precogs workflow | Orchestrates the panel: three reviewers in parallel, then a synthesis that dedupes and cross-votes findings. | [`workflows/`](workflows/) |

Each folder's README has the install steps and the reasoning; everything
targets `~/.claude`. Run all install commands from the repo root.

## The flow in one paragraph

The main session is an orchestrator: it plans against an ADR/spec, hands
implementation to agents (Geralt — backend, Lyutik — frontend), verifies
results, and never burns its own context on writing code. The status line
keeps the context % in view; at ~30% the work is handed off (`/handoff`) and a
fresh session picks it up (`/pickup`). Diffs go to a review panel of three
different models, briefed with nothing but the spec and the code. The output
style plus the re-inject hook keep every reply short enough to actually read.

## License

MIT

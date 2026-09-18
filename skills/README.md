# Skills

Two groups: the development cycle from a task to a PR, and the session
continuity that keeps that cycle alive across context windows.

## Install

```bash
mkdir -p ~/.claude/skills
cp -r skills/adr skills/spec skills/implement skills/twix skills/handoff skills/pickup ~/.claude/skills/
```

`implement` runs your project's own commands. Its `CLAUDE.md` must name the
stack start command, the ports, the health endpoint and the test/lint/build
commands — the skill reads them there, it does not guess.

## Development cycle — decide, cut, run

| Skill | Role | What is on disk after it |
|-------|------|--------------------------|
| [`adr/`](adr/SKILL.md) | Makes the architectural decisions with you, one at a time, each with options and a recommendation. Decides; does not plan the work. | `<feature>-decisions.md` (or `docs/adr/<domain>/`) and a storyboard `<topic>-storyboard.html` — the mechanism as a story, one Mermaid scene per moment, drawn by Ariel. |
| [`spec/`](spec/SKILL.md) | Cuts the closed ADR into phases an implementer agent can run: scope, files, edge cases, acceptance, a layered verify checklist. Decides nothing. | `<topic>-spec.md` (or a `<topic>-spec/` directory) next to the ADR. [One real phase](spec/examples/phase-example.md) as the reference. |
| [`implement/`](implement/SKILL.md) | Runs ONE phase: briefing → implementer agent → gate against acceptance → review panel → local testing → commit. | One commit per phase, the phase marked done in the spec, the handoff pointing at the next one. |
| [`twix/`](twix/SKILL.md) | The review panel `implement` calls: two reviewers on the diff (Agatha + Arthur, or Arthur + Dash), and the panel rules every reviewer run follows. | One merged verdict in four buckets: found / fixing myself / needs your yes / rejected and why. |

The three files stay out of git (`.git/info/exclude`): they are working
artifacts of one feature, the code is the deliverable. What survives is the
reason, carried into the code and its docs — never a label like "ADR 5".

Two rules run through all four:

- **The session decides nothing alone and writes no code.** Decisions get an
  explicit yes each; implementation goes to agents; the session verifies.
- **Reviewers get the diff and the spec, never "we already fixed X".** A
  primed review confirms; a neutral one finds.

## Session continuity — handoff and pickup

My working observation: answer quality is sharp below ~30% of the context
window and degrades noticeably after. So sessions are deliberately short, and
the work has to survive the switch.

Why not `/compact`: it decides for you what survives, and you find out what it
kept only in the next session. No control, no granularity. A handoff file is
deliberate — task state, what's done, what's ruled out and why, and the exact
next step.

| Skill | Role |
|-------|------|
| [`handoff/`](handoff/SKILL.md) | Writes/updates `HANDOFF_<slug>.md`: state of the task + instructions for the next executor — never a chronology of the session. |
| [`pickup/`](pickup/SKILL.md) | The new session finds the handoff, **verifies it against reality** (git log, files, cheap checks) and starts from the NEXT step. A handoff is a snapshot, not gospel. |

Work until context quality starts to degrade → `/handoff` (the file lands in
the project root, kept out of git via `.git/info/exclude`) → `/clear` or a new
session → `/pickup` → continue from the same point. `implement` reads the same
handoff to find the next phase, so the cycle and the continuity share one file.

The design decisions that matter, both learned the hard way:

- **WHAT, not HOW** — the handoff records state and facts, never this
  session's investigation plans or half-formed conclusions. Dead ends and
  wrong mental models must not be transplanted into a fresh head.
- **Negative knowledge is first-class** — what was ruled out and WHY stops the
  next session from re-digging the same hole.

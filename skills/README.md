# Skills — session continuity

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

## Install

```bash
mkdir -p ~/.claude/skills
cp -r skills/handoff skills/pickup ~/.claude/skills/
```

## Usage cycle

Work until context quality starts to degrade → `/handoff` (the file lands in
the project root, kept out of git via `.git/info/exclude`) → `/clear` or a new
session → `/pickup` → continue from the same point.

The design decisions that matter, both learned the hard way:

- **WHAT, not HOW** — the handoff records state and facts, never this
  session's investigation plans or half-formed conclusions. Dead ends and
  wrong mental models must not be transplanted into a fresh head.
- **Negative knowledge is first-class** — what was ruled out and WHY stops the
  next session from re-digging the same hole.

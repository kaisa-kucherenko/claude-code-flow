---
name: pickup
description: >
  Start a fresh session from a handoff file written by /handoff — find it, read it,
  verify it against current reality, and begin the NEXT step. Triggers: "/pickup",
  "pick up the handoff", "continue from the handoff", "підхопи хендоф",
  "продовжуй з хендофу" (add triggers in your own language), or a session opening
  with an @-mentioned HANDOFF file. Counterpart of /handoff.
---

# Pickup — continue from a handoff

## Find the file

- `/pickup <slug|issue|topic>` — match against handoff filenames.
- `/pickup` bare: glob the project root for `HANDOFF_*.md`.
  - Exactly one → proceed.
  - Several → show a compact list: filename, header topic, last-updated date, first
    line of its NEXT section — ask which to pick up.
  - None → say so; don't invent a handoff.
- An @-mention that failed to attach (typo like `HENDOFF`) is still a pickup request
  — glob and read the file yourself.

## Verify before acting — never execute a handoff blindly

The file records conclusions as of its write time; ground truth may have moved.
Before starting:

1. Compare its recorded branch/HEAD/commit hashes against `git log` — flag commits
   that appeared since, or a recorded HEAD that is gone.
2. Spot-check that key files/artifacts it names still exist.
3. If it lists verification commands with checkpoints, run the cheap ones.

Report in a few lines: the task, what the handoff says is next, and any divergences
found. Material divergence (the plan's premise no longer holds) → surface it and ask
before proceeding. Cosmetic drift → note it and continue.

## Work rules

- Start with the **NEXT** section — or the user's explicit steer in the same
  message ("do step 4") which overrides it.
- **"Ruled out — do not reopen" is a hard constraint**: do not re-litigate
  ruled-out hypotheses unless new evidence contradicts the recorded reason.
- Open questions in the file are the user's to answer — ask when one blocks the work.
- Need detail the file lacks? The header's session id allows `claude --resume <id>`
  in another terminal; prefer asking the user before archaeology.
- From here on this file is the live handoff of THIS session — /handoff updates it
  (and marks stages done) as work progresses.

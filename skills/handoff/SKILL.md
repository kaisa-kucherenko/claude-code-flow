---
name: handoff
description: >
  Create or update a session handoff file so a fresh session continues seamlessly
  where this one stopped. Triggers: "/handoff", "make a handoff", "update the
  handoff", "add to the handoff", "is the handoff current?", "зроби хендоф",
  "онови хендоф", "запиши в хендоф" (add triggers in your own language).
  Create ONLY on explicit request (never unprompted); once the file exists, keep it
  current through the session. Universal across projects. Counterpart: /pickup
  reads the file in the new session.
---

# Session Handoff

Writes the state of the current work thread into a file the next session can start
from — because answer quality degrades well before the context window is full, and
a deliberate, writer-controlled handoff beats automatic summarization.

A handoff is **the state of the task + instructions for the next executor** — never
a chronology of this session.

## Files

- **Name:** `HANDOFF_<slug>.md` in the project root. Slug = issue number + short
  topic (`HANDOFF_237_deploy.md`) or topic alone (`HANDOFF_pricing_banner.md`) —
  readable at a glance, since several handoffs may coexist for parallel work threads.
- **One live handoff per work thread, updated in place.** No date-stamped copies.
- **Git hygiene:** immediately add the filename to `.git/info/exclude` (never
  `.gitignore`, never stage, never commit). Before any staging of adjacent files,
  `git check-ignore -v` the handoff. Not a git repo → skip this step.
- Delete the file when its task is fully closed (confirm with the user first).

## Invocation

- `/handoff` — no args: if exactly one handoff matches the session's current work
  thread, update it; none → create; several plausible → ask which one.
- `/handoff <slug|issue|topic>` — explicit target.
- Mid-session "add X to the handoff" — add X to the relevant section now, verbatim
  in meaning. Items the user explicitly names ("make sure X is in") MUST land in
  the file.
- "Is the handoff current?" — reread the file, diff it against the real session
  state, fix every stale point, then confirm.

## Structure

```markdown
# Handoff: <issue #N / topic> — <last updated>
Branch: <branch> @ <short-hash> | Source session: <session id, best effort>

## NEXT
<the new session's concrete first step; then a numbered plan, WHAT-level>

## State / Result
<result first, with numbers where they exist; then git: commits with hashes,
pushed/NOT pushed, what to commit / what NOT, how to restore anything deleted>

## Done
<one terse block per closed stage: hash, essence, who reviewed,
what was consciously deferred (follow-up, not pre-merge)>

## Ruled out — do not reopen
<dead ends and dropped hypotheses WITH THE REASON they are dead ends>

## Don't forget
<env gotchas, sharp details, runnable commands with checkpoints
to verify the environment is alive>

## Artifacts
<issue/PR/ADR URLs, key files with their role; durable knowledge — as a link
to a reference doc or memory, never as a copy>

## Open questions
<decision points AS QUESTIONS — or an explicit "None">
```

Empty sections are dropped. Language of the file = language of the conversation.
Session id: try `$CLAUDE_SESSION_ID`; else newest `.jsonl` in
`~/.claude/projects/<project-slug>/`; parallel sessions make that ambiguous — omit
rather than guess. It lets the next session pull details via `claude --resume <id>`
without loading the whole transcript.

## Content rules

- **WHAT, not HOW.** No step-by-step investigation plans ("1. Read X, 2. Grep Y"),
  no solution proposals as conclusions, no risk/effort forecasts. Strip markers:
  "should probably…", "I recommend…", "likely root cause…", "the next session
  must…". This session's dead ends and wrong mental models must not be
  transplanted. Allowed: repro steps, symptoms/facts, what was tried and excluded
  (with numbers), decision points as questions.
- **Result first.** "What we achieved + numbers", never "what we did". If the user
  shared measurements/screenshots this session, their essence goes in.
- **Negative knowledge is first-class.** What was ruled out and WHY — it stops the
  next session from re-digging.
- **Reference, don't duplicate.** Durable domain knowledge belongs in a reference
  doc / project memory; the handoff links to it.
- **Record divergences** between the file's assumptions and reality when you notice
  them (e.g. manual edits outside the branch) — the next session must know.

## Live-document behavior

- Creation — only when the user asks. Updates of an EXISTING file: on request, and
  proactively right after a stage completes (collapse the stage's detailed plan into
  a short "Done" block with hashes; announce in one line).
- After writing, reread the file once and strip anything violating the content
  rules before reporting done.

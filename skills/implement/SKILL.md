---
name: implement
description: >
  Runs ONE phase of a phase spec (written by /spec) through the full cycle: find
  the next phase from the live handoff, brief the user first, launch the implementer,
  freeze the tree, gate the diff against the phase's Acceptance, external review of the
  user's choice, local testing, commit, mark done, update the handoff. Triggers:
  "/implement" (next phase from the handoff), "/implement N", "фаза N", "запускай фазу",
  "роби фазу", "наступна фаза", "run phase N". Needs a spec with a phase map; without
  one, stop and point at /spec.
allowed-tools: Read, Grep, Glob, Write, Edit, Agent, Bash(git log:*), Bash(git status:*), Bash(git diff:*), Bash(ss:*), Bash(curl:*), Bash(setsid python3 -m http.server:*)
---

# Implement — run one phase of a spec

The spec says what; this skill is how a phase moves from text to a commit without the
user losing the thread. One invocation = one phase.

## Prerequisites

A Linux or macOS shell with `ss` (or `lsof` — adjust the port checks), `setsid`, and a scripted
browser (playwright) for `browser` rows. `<scratchpad>` is the session's temporary directory —
any per-session temp path works, it only has to survive the phase. The project's `CLAUDE.md`
must name its stack start command, its ports, its health endpoint and its test/lint/build
commands: this skill runs them, it does not guess them.

## 0. Which phase — the handoff decides

**Main flow (`/implement`, no number):** read the live handoff (`HANDOFF_*.md` in the project
root; several → the one whose topic matches the current branch/issue). Its **NEXT** names
the next phase and the spec path; the handoff's done-section («Зроблено» in a Ukrainian
handoff — the heading follows the handoff's language) lists the phases already committed. If
NEXT does not name the spec path, look in the handoff's Artifacts section; still nothing →
ask before launching, do not guess. Cross-check against the spec index's phase map and
`git log` on the branch — a phase marked done in the handoff but absent from the log (or the
reverse) is a divergence: say so, stop.

**Spec index** = the single spec file (`<topic>-spec.md`) or the directory's `README.md` —
whichever the spec has; it carries the preamble, the Ground rules and the phase map, and it is
where a phase gets marked done (step 7).

**Alternative (`/implement N`):** the user names the phase. Still read the handoff for the spec
path and the done-list; if N's dependencies are not done, say so, stop.

No handoff → the spec index's map is the only source; say that the handoff is missing and
offer /handoff before continuing.

Spec location: the path in the handoff; else `<topic>-spec.md` or `<topic>-spec/README.md`
next to the ADR (project root, or `docs/adr/<domain>/` for a split ADR). Phase file: `NN-<name>.md` or the `## Phase N` section.

## 1. Briefing — before anything else, every phase, every session

Tell the user in plain language, 3–6 lines, no jargon, no file names:
- the user's problem this phase addresses (from the ADR's problem statement);
- what changes (behaviour, not code);
- what they will see when it is done;
- who implements, roughly how long.

The same message ends with the ONE question of the phase: `twix` (Agatha + Arthur), `twix light`
(Arthur + Dash) or `precogs` (Agatha + Arthur + Dash + synthesis), with a recommendation and one
line why. The user reads the briefing and picks the review depth right there — so the review later
starts without stopping the user mid-work. Wait for the answer, then launch. A phase resumed in a new
session gets the briefing (and the question) again.

Right before that question, one line names the **specialists** the session will add on top of
the panel — `Specialists: Gilfoyle (ownership matrix, IDOR), Lauda (N+1 in the new query)` — or
`Specialists: none` with the reason. The session picks them from the phase's own surface
(auth/ownership/secrets → Gilfoyle; hot path, token cost, new queries → Lauda; new
screens/states → Jobs; schema, migrations, user-facing copy → your own advisors if you have them);
the user can add or strike a name in the answer. The session picks the specialists; the line makes
the roster visible before the phase starts.

## 2. Launch the implementer

The agent named in the phase (Geralt / Lyutik / …). Prompt contains: the phase file
verbatim, the ADR sections it cites, the spec index's Ground rules, the spec preamble's
problem statement (whose problem the phase solves and what the user will see when it is done —
so the agent knows what it is for, not only what to type), "implement the
phase, its tests, run the Verify commands, report diff summary + test output; no
commits; no scope outside the phase; if the phase contradicts the ADR or the code,
stop and report instead of choosing; **no decision labels in persistent text** — the prompt
cites `ADR 5` so the implementer can read the rationale, the code/docs/tests carry the
rationale itself, never the label or a `docs/adr/...` path (the ADR is not committed)".

Reuse the same agent across sequential phases (SendMessage) while its context stays under
~30% of its window — warm context is cheap when it is the same files, dead weight past that.
Report the percentage after each completion when the runtime gives one (the task
notification's `usage`); when it does not, say "unknown" and take a fresh agent — never
invent a number. The same-vs-fresh call is the user's.

If a reviewer or a second agent must run in parallel with a blocking Agent call, launch the
background Bash (`run_in_background: true`) BEFORE the Agent call — a blocking Agent occupies
the turn, so anything queued after it starts only when it returns.

## 3. Frozen tree

While any agent (implementer or reviewer) runs, the session edits nothing in the working
tree — no fixes, no stash, no doc touch-ups. Reading is fine.

## 4. Gate — the session verifies, the agent does not self-certify

- Diff against **Acceptance** line by line; each criterion answered with evidence
  (command output, grep result, screenshot).
- Run the phase's **Verify** rows that need no running stack (`unit` layer) yourself, even if
  the agent says it did. The `api` and `browser` rows are deferred to step 6 by design — the
  stack goes up only after the review — so the gate stays open on those rows until then.
- ADR check: nothing in the diff decides what the ADR did not.
- Small fixes the session applies itself (an agent round is 5–10 min even for a
  one-liner); big ones go back to the implementer with the finding, not a solution.
- **No separate gate report.** A clean gate goes straight into the external review; the
  gate's findings ride in the ONE report after the review (step 5). The only reason to
  stop here is the escalation rule below.

## 5. External review — the panel the user named in the briefing

Run the panel from step 1 (`twix`, `twix light` or `precogs`) plus the specialists named there,
without asking again. Panel rules — scope, prompt contents, frozen tree, verify-before-patch,
byte-identical re-run — per `/twix`. Each finding is a claim: rebut wrong ones with evidence.
**One report for the phase**, after the review, gate + review merged, buckets:
done / found / fixing myself / needs your yes / rejected and why. Implementation-level
fixes are applied before the report, not proposed in it.
Two failed patches on the same finding → stop, hand it to a reviewer with what was tried and
ruled out; never a third patch in the same direction. Review temp files (`.*-review-*.tmp`) are
removed in their own Bash call right before the commit, without asking — **never chained with
`git add`/`git commit`**: every git write is a standalone call the user approves by hand, and a commit
fused with `rm`/`sed`/anything else is a monster nobody can review.

## 6. Local testing — where the phase allows it

**Only after the external review is closed and every code fix is in.** Backend changes do not
hot-reload: each fix after a stack test means restarting the project's stack, minutes each time.
So the stack goes up ONCE per phase, after the last code change — it is not needed for the gate
or the review (unit tests, linters, builds run without it).

**The session starts the project's stack itself here** — the one place in the cycle where it
does; everywhere else the owner runs it. Once per phase, after the last code fix, with the
project's own start command (from its `CLAUDE.md`):
- Before starting: `ss -ltn | grep -E ':(<the project's ports>) '` — if something already
  listens, it is the owner's; do not start a second copy, ask.
- Start it in its OWN process group — the stop below only works on a group:
  `setsid bash -c 'echo $$ > <scratchpad>/stack.pid; exec <start command>' > <scratchpad>/stack.log 2>&1 < /dev/null &`
  Wait for the project's "started" line in the log, then hit its health endpoint.
- Stop = SIGINT to the whole group, what an IDE's Stop button does: `kill -INT -- -$(cat <scratchpad>/stack.pid)`,
  then the same `ss -ltn` check must print nothing. The frames server on :8765 stays up until the phase report is read — stop it only when the user is done with the frames or the session ends. Report "stack down, ports free" with that empty output. Never `kill <pid of a bash -c wrapper>` (the Bash tool's
  wrapper has no trap and leaves every child service running) and never
  `pkill -f '<pattern>'` (matches the session's own shell, exit 144).

**A product bug found here reopens the phase, it does not get patched in passing.** The loop:
fix → re-run the gate rows the fix touches (step 4) → if the fix is more than a one-liner, the
panel runs again under the re-run rule in `/twix` (the user's word, byte-identical prompts) →
stack up again → the affected scenarios again. "Once per phase" describes the path where
nothing breaks; a phase that breaks pays for the restart, and the report says so.

**What gets tested is the phase's Verify checklist — as written, nothing invented.** The spec
assigned each criterion a layer (`unit` → `api` → `browser`) and named its test data. Rules:
- **Cheapest layer that proves the claim.** Never climb to the browser for what curl or a
  test already proved. Reuse the seeded data the spec names; if the scenario needs data or a
  state the spec did not foresee, that is a spec gap → Escalation, not improvisation.
- **One real run per phase where the phase has a write path, on top of the checklist.** At
  least one scenario goes through the product's own write path (an upload, an agent turn that produces a file) — not seeded rows,
  not a fixture handed the value the code hopes for — and the session LOOKS at the screen that
  shows the result: dates and relative times ("2 minutes ago", "Expires …") are read against the
  wall clock, labels against the data. Seeded rows and unit fixtures exercise the read side only;
  a Verify row can pass while every new file shows a wrong relative time — only the screen
  catches it.
- **Harness breaker — two attempts.** Tell apart a PRODUCT failure (wrong response, wrong
  render: fix or escalate) from a HARNESS failure (selector, login, playwright session, a bad
  seed row, a port). A harness failure gets two attempts; the third is a one-line hand-off to
  the user: "open X, click Y, tell me what you see" / "do Z by hand". Their minute beats fifteen of
  workaround hunting: a non-hex seed id or a stack that will not stop are harness failures —
  hand over or cut, never a third attempt.
- **Browser in batches.** One playwright script per scenario, frames at the checkpoints the
  spec names, read once. Never click → screenshot → click.
- **Visual phases: the session builds, the user judges — from files, not an artifact.** Shoot every
  state the spec lists in one batch into `.frames/<phase>/` in the repo root (add `.frames/` to
  `.git/info/exclude`; the scratchpad is `/tmp` and dies with the machine). Serve that folder so
  the links open in the user's browser from the terminal — a bare path is not clickable, an `http://`
  link is:
  `setsid python3 -m http.server 8765 --bind 127.0.0.1 --directory .frames > <scratchpad>/frames-server.log 2>&1 < /dev/null & echo $! > <scratchpad>/frames.pid`
  (skip if `ss -ltn | grep ':8765 '` shows it already running and `<scratchpad>/frames.pid`
  exists — a listener without a pid file is someone else's, use another port). Stop it like the
  stack, by group: `kill -INT -- -$(cat <scratchpad>/frames.pid)`. The report lists each frame as
  `http://127.0.0.1:8765/<phase>/<file>.png` + one line on what to look at. No artifact grid for
  verification frames (they pile up in the gallery and cost ~40k tokens for
  one look) — an artifact only for an audience beyond the user or on their ask. Frame-by-frame rounds
  stay the anti-pattern: one batch, one verdict.
- **Report = a table** criterion → layer → result (value or frame), one row each, plus the
  `not testable locally` rows verbatim from the spec. No narrative of the search.

Stack tooling: the project's start command as above, a scripted browser (playwright), the project's own test helpers.

## 7. Commit, mark done, handoff

- One phase = one commit; the user approves the commit, as always.
- Mark the phase done in the spec index (a Status column or a ✓ in the map).
- Update the live handoff: «Зроблено» gets the hash + one line; **NEXT** now names the
  next phase. This is what step 0 of the next invocation reads.

## 8. Next

Brief the next phase (step 1) and **stop — the launch waits for the user's word.** The
briefing inside a running invocation is context, not a start signal; a new phase is a new
`/implement` (or the user's explicit "go"). If the next phase's implementer differs and its
dependencies are met, independent phases may run in parallel — but only in separate git
worktrees, each with its own review scope and commit; in one working tree the frozen-tree rule
(step 3) makes parallel phases impossible, so there they run one after another. Say which in
the briefing.

## Escalation — when to stop and ping the user

The user wants to hear from the session only when the plan itself is in question. Stop, ping, and
do not move without them when:
- the gate or a reviewer finds a bug in the LOGIC the ADR decided, or the code shows an ADR
  decision does not work;
- something unplanned: the phase contradicts the code, the implementer left the scope, a
  product decision or user-facing copy is needed.

Everything else — implementation fixes, review triage, test scaffolding, starting and
stopping the stack, retries — the session decides and reports in the one phase report.

## Anti-patterns

| Avoid | Instead |
|---|---|
| Picking the phase from memory of the conversation | The handoff's NEXT + the spec map + `git log` |
| Launching the agent, then explaining | Briefing first — the user knows what happens before it happens |
| Agent commits, or expands to "while I'm here" fixes | No commits; scope = the phase file |
| Trusting "tests pass" from the agent | Run Verify yourself; show output |
| Every Verify row closed by a seeded row, a fixture or curl; nobody produced a file through the product and looked at the screen | One real run per phase through the product's write path + one look at the result with dates/labels read against the clock |
| A reviewer "confirms" an environment assumption by reading the comment that states it | Verified against the running environment, or reported UNVERIFIED |
| Editing the tree while an agent runs | Frozen; queue the fix for after |
| Committing before external review and local testing | Gate → review → test → commit, in that order |
| Starting the stack before the review is closed | Stack once, after the last code fix — every restart costs minutes |
| Leaving the stack running after the scenarios | `kill -INT` the launcher's process group (setsid start), verify the project's ports are free |
| Asking "twix or precogs?" after the gate | The question lives in the briefing; mid-work questions are what the user asked to remove |
| A separate gate report before the review | One report per phase, after the review, gate merged in |
| Third attempt at a broken selector / login / seed row | Two attempts, then hand the user the one manual step |
| Inventing a test scenario or test data mid-phase | Verify checklist as written; a missing case is a spec gap → Escalation |
| Browser click-by-click with a screenshot each | One batched script per scenario, frames at the spec's checkpoints |
| An artifact grid of verification screenshots | `.frames/<phase>/` served on :8765, `http://` links + one line each in the report |
| Re-deciding an ADR point because the code made it awkward | Stop; ADR first, then the phase |
| Skipping the briefing on a resumed session | The new session briefs again |
| Launching the NEXT phase's agent right after the commit because the briefing was written | Brief, then stop; the launch is the user's call |

---
name: spec
description: >
  Turns a closed ADR into a phase spec an LLM implementer executes phase by phase: cuts,
  orders and describes — decides nothing (the ADR did), implements nothing (the
  implementer agents do). Triggers: "/spec", "спека", "напиши спеку", "спека фаз",
  "нарізка фаз", "write the spec", "phase spec". Requires an ADR with no decision left
  PENDING (each DECIDED or DROPPED) and its review closed — without one, stop and point at /adr. Running the phases (briefing, gate,
  review, commit) is /implement, not this skill.
allowed-tools: Read, Grep, Glob, Write, Edit, Agent, Bash(wc:*), Bash(ls:*), Bash(git check-ignore:*)
---

# Phase spec — phase plan from an ADR

The ADR says WHAT was decided and WHY. The spec says in what order, in which files,
with which acceptance criteria — and nothing else. Every phase of the spec must trace
back to an ADR section; anything that does not is either the session's own call
(flag it to the user) or does not belong. Where this skill and the project's `CLAUDE.md`
disagree on a convention (test runner, file layout, doc rules), the project wins — the
spec is written for that project's implementer.

## Inputs — all three, or don't start

1. **ADR** with no decision left PENDING — each DECIDED or DROPPED — and its review closed (produced by `/adr`). Open decisions → back to the
   ADR, not into the spec. The spec never re-decides; where they disagree the ADR wins
   and the spec is fixed. If writing the spec exposes a contradiction inside the ADR,
   stop and ask — the ADR is corrected first, then the spec.
2. **Issue, or the ADR's problem statement** when the feature came from a conversation — the 30-second "why" for the spec preamble.
3. **Agent roster** — who implements (Lyutik / Geralt / …), to size phases for their context.

## Language

**The spec is always English**, whatever language the conversation runs in. It is read by
the implementing agent, not the user: English costs fewer tokens and the model reads it
better. The ~400-line budget below is an English budget — Cyrillic at the same length is
a different size and token count. The ADR's language is the user's choice (they read it);
the spec quotes its section numbers, not its prose.

## Before writing — verify against the code, not memory

Every file, export, constant, line count and "used nowhere" claim in the spec must be
checked with `grep`/`wc`/`ls` first. A spec that names `Sidebar.tsx` when the file is
`LeftSidebar.tsx`, or says a store field is unused when two components read it, costs the
implementer a phase. Concretely, before the first line:

- locate every file the ADR names; note size (`wc -l`) — the cut depends on it;
- grep the identifiers the phases will rename/delete — who imports them;
- check what test/lint/build tooling exists (`package.json` scripts, `pytest.ini`) — the
  verification rule must name real commands;
- read the project's `CLAUDE.md` lines that describe the behaviour being changed — each
  phase that changes them must update them.

## Cutting phases

- **One phase = one reviewable diff = one commit.** A reviewer must be able to hold the
  whole diff; a phase that needs a summary to be reviewed is two phases.
- **Explicit dependencies** in a phase map table (`#`, phase, ADR refs, depends on).
  New artifacts have a single owning phase; later phases reference, never re-declare.
- **Scope fits the implementer's context** — roughly 30% of its window per phase.
  Big new component + deletion of two old ones + page wiring is the ceiling, not the norm.
- **No non-working intermediate states across phases** unless the branch is not deployed
  between them — then say so explicitly in the phase.
- **Order by risk and reuse:** foundations (stores, state) first, surfaces that consume
  them after, mobile/responsive after the desktop surface exists, cosmetic sweeps last.
- **Tests ride with the logic they test**, in the same phase; tooling (test runner,
  config) lands in the first phase that has something worth testing.

## Who writes what

- **The session writes every phase** from the ADR: scope, files, edge cases, acceptance,
  verification. The implementer never sets its own scope or criteria — the same rule as
  "doesn't review its own code", one step earlier.
- **A profile agent (Jobs, Lauda, Gilfoyle, …) writes a phase only when a different agent
  implements it** (Jobs → Lyutik). Otherwise it is the executor scoping itself.
- **The implementer reviews the cut once** (Review step 2) — as a reviewer of the plan,
  not its author. It never writes or amends a phase.

## Phase template — WHAT, never HOW

```
## Phase N — <name> (<ADR refs>)

**Goal.** Why this phase exists; what is true after it that was not before. 2–3 lines.

**Scope.** Bullets of behaviour and boundaries. Name the files/identifiers touched,
say what moves/dies/appears. Leave component boundaries and internal decomposition to
the implementer — write "implementer's call" where the ADR left it open.

**Files.** New / modified / deleted, plus the CLAUDE.md lines this phase must update.

**Edge cases.** The non-obvious ones the implementer would miss: SSR, hydration, two
mounts, stale storage, degraded responses, breakpoints, focus/Escape.

**Acceptance.** Verifiable results, not commands. A one-line `grep … → empty` is fine;
a bash block is a runbook — cut it.

**Verify.** An executable checklist the SESSION runs as written — one line per Acceptance
criterion: **layer** → concrete call/input → expected value. Layers, cheapest that proves
the claim: `unit` (pytest/vitest, no stack) → `api` (curl/SQL against the stack) →
`browser` (playwright, only for what is visual or click-driven; name viewport + theme +
what the frame must show). "Test in the browser" is not a scenario; "browser 400px dark:
expired card greyed, no Download button" is. Test data the scenario needs (a seeded row,
a user state) is named here too — the session must not invent it mid-phase. A criterion
that has no runnable local check says `not testable locally` explicitly.

**Rollback.** `Revert.` unless something lives outside code (storage keys, GTM tags,
migrations) — then say what stays behind and whether it is harmless.
```

Preamble before the phases: source ADR + "the ADR wins", issue/branch/wireframe links,
**Ground rules** (implementer, gate — the session's check of the diff against each phase's Acceptance, run by `/implement` — design source, verification commands, test policy,
doc-update rule, rollback default, "no backend changes" or the opposite, and the line
"phases are run with /implement: briefing to the user first, then the agent"), then the
phase map table. Close with **After the phases** — PR, changelog, manual steps outside code
(GTM tags, cron), follow-ups the ADR deferred.

## Format — the skill decides, no question to the user

- One file up to **~400 English lines** → `<topic>-spec.md` next to the ADR.
- Beyond that, or 8+ phases → a directory `<topic>-spec/` with `README.md` (preamble +
  map) and `NN-<phase>.md` per phase, 60–120 lines each.
- Estimate from ADR size × phase count before writing; do not write 600 lines and split
  afterwards.
- **Placement:** next to the ADR — project root for a single-file ADR, inside its
  `docs/adr/<domain>/` directory for a split one — listed in `.git/info/exclude` (never
  `.gitignore`, never staged). Check with `git check-ignore -v` after adding.

## Review — three steps, in this order, none optional

1. **Self-review against the ADR** — every DECIDED section maps to at least one phase;
   every phase cites its sections; no phase contains a decision the ADR did not make.
2. **Implementer review of the cut** — send each implementer (Geralt, Lyutik, …) its own
   phases + the ADR + the spec preamble (the file itself, or the directory README), read-only, in parallel. Ask five things: cut
   (split/merge), order/dependencies, wrong facts (files, lines, "only caller" claims,
   commands), missing edge cases, feasibility. "Phase N: clean" is a valid answer and
   must be offered as one. Implementation-level findings the session verifies and applies
   itself; only findings that touch ADR logic go to the user, in plain language. Record
   the outcome in the preamble ("Implementer review of the cut: <date>, <what changed>").
3. **Present to the user:** the phase map table plus a short list of the calls that are
   the session's own. The boundary: how to cut, in what order, how to verify — those are
   the spec's calls and belong on this list; what the product does or how it is built is
   the ADR's, and a gap there goes back to `/adr`, never onto this list. Wait for the user's explicit yes.
   Do not start the next step on silence.

External review (Agatha/Arthur/Dash, `twix`, precogs) only on the user's command.
Reviewers push toward runbooks and toward re-deciding — hold the line; verify BLOCKING
claims against the files before applying.

## Anti-patterns

| Avoid | Instead |
|---|---|
| Spec in the conversation's language | English, always |
| Re-deciding an ADR point "because it's cleaner" | Stop, fix the ADR with the user, then the spec |
| Implementation code or bash blocks in acceptance | Result criteria + one-line hints |
| Naming files/exports from memory | `grep`/`ls` first; the spec is a contract |
| Implementer writes its own phase | Session writes; implementer reviews the cut (Review 2) |
| Skipping Review 2 to save time | One parallel agent round; skipping it has cost ~20 corrections found mid-phase instead |
| Component tests / snapshot tests in a frontend phase | Logic tests only; markup via playwright by the session |
| A 600-line single file | Estimate first; directory when over ~400 |
| "Update docs at the end" | Each phase names the CLAUDE.md lines it changes |
| Spec committed to the repo | Root + `.git/info/exclude`; the code is the artifact |

## Example

[`examples/phase-example.md`](examples/phase-example.md) — one real phase (quota store extraction): the
template filled in with verified file names, five named test scenarios, and the
CLAUDE.md lines it owns.

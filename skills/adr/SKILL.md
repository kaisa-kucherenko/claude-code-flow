---
name: adr
description: "Architecture Decision Record — structured approach to making architectural decisions for complex features. Use when: user needs to design a new feature that touches multiple layers (DB, API, frontend, security), user says '/adr', 'architectural decisions', 'decision tree', 'архітектурні рішення', 'давай продумаємо архітектуру', 'треба прийняти рішення по архітектурі', or when a feature is too complex to just start coding. Also trigger when user has a GitHub issue for a feature and wants to plan implementation before writing code. This skill is about DECISIONS, not implementation — it produces a decisions document that serves as the spec."
allowed-tools: Read, Write, Edit, Glob, Grep, Agent, WebSearch, Bash(gh issue view:*), Bash(git check-ignore:*), Bash(wc:*)
---

# Architecture Decision Record (ADR)

"Beads on a necklace" — sequential isolated decisions that build on each other. Each decision narrows the space for the next one.

## What this skill produces

**Default — single file `{feature}-decisions.md`** in the project root. This file is the source `/spec` cuts phases from: it records the decisions and their reasons, not the order of work. Works well for features up to ~15 decisions and ~800 lines.

**The document opens with two things, before any decision:** a short "How it works" (the
whole mechanism in 5-10 lines, as it stands after the decisions made so far — rewritten as
decisions land) and a status table (number, title, DECIDED / PENDING / DROPPED). A reader
who lost the thread re-anchors here, not by scrolling the decisions.

**Companion visual — the storyboard "Life of one X".** The main visual of the ADR, built
together with the decision tree in Phase 3 and kept alive through Phase 4 (see there). The
tree is a list; the storyboard is the story the list is about — it is what makes the whole
picture hold at the end instead of falling apart into sixteen items.

**For larger features — split into per-decision directory** `docs/adr/{domain}/`:
- One README.md (index + status table + reading order)
- One file per decision or per tightly-grouped decision cluster (e.g. `01-platform-install.md`, `02-schema-source-of-truth.md`, ..., `11-documentation-rollout.md`)
- Logical grouping, not strict 1-to-1 (combine tightly related decisions into one file when they share rationale, e.g. `3 + 4` → single file; keep large independent decisions like `7` standalone)
- Cross-references via markdown links (`[02-schema-source-of-truth.md](02-schema-source-of-truth.md)`) instead of inline `per 7` text

**When to split — one scale:** ~800 lines / ~25 KB or 15+ decisions. Past ~800 lines the
Read tool hits its 25k-token limit on Cyrillic content and humans stop reviewing coherently;
past 15 decisions the file keeps growing, so split early. Two further triggers regardless of
size: unrelated domains in one ADR (DB + secrets + CI — targeted edits and smaller review
passes), and a project that already uses `docs/adr/{domain}/`. Below the scale, stay in one
file — a split adds navigation for nothing, and a prototype whose decisions will consolidate
or die is not worth the carpentry.

**Directory naming for splits — name by domain, not by trigger:**
- ✅ `docs/adr/database/` — broad domain, future DB-related ADRs land here too
- ❌ `docs/adr/local-postgres-setup/` — too narrow; misleading if ADRs also cover prod flow, migrations, ownership
- The trigger may be a specific need (e.g., local Postgres setup), but the ADRs typically end up covering wider territory — pick the wider directory name from the start

When no decision is left PENDING (DECIDED or DROPPED) and the review is closed, the next step is `/spec` (Phase 6).

**Git hygiene — every file this skill creates is excluded from git by default.** Right
after creating the decisions file or the `docs/adr/{domain}/` directory, add its path to
`.git/info/exclude` (never `.gitignore`, never stage, never commit) and verify with
`git check-ignore -v`. ADR documents are working artifacts of one feature; most are never
needed again once implemented. They enter the repo ONLY when the user explicitly says
to keep this one — that is the exception, not the default. Research files and
synthesis documents from Phase 2 follow the same rule.

## The process

### Phase 1: Understand the problem

Accept input — one of:
- Feature description from the user
- GitHub issue number → `gh issue view {number}` to read
- Ongoing conversation where user described what they want

Extract: what needs to be built, for whom, why, what constraints exist.

### Phase 2: Research (optional, user decides)

If the problem space is unfamiliar or has industry precedent worth studying:

- Propose research directions to the user
- Launch parallel research agents — the session's model when the research needs judgement, one step down when it is collection and summary; each saves results to its own file in the project root
- After all agents finish, create a synthesis document that extracts cross-cutting patterns

Research is expensive (time + tokens). Ask the user: "Worth researching how others solve this, or straight to the decisions?" If the user already has context, skip to Phase 3.

### Phase 3: Build the decision tree

Identify ALL decisions that need to be made. Group by domain:

```
1. DATA MODEL — what we store and how
2. STORAGE — where and how we store it
3. LIFECYCLE — how data is created, updated, dies
4. INTEGRATION — how it connects with existing system
5. SECURITY — protection, governance, compliance
6. USER INTERFACE — what user sees and controls
```

These are common groups but not mandatory — adapt to the feature. A simple feature might have 4 decisions. A complex one might have 20. The tree should be exhaustive — discovering a missing decision mid-discussion breaks the flow.

**Cut the tree so that one question = one choice.** A stub that hides two choices ("where
it lives AND how it syncs") gets discussed twice and fixated once — split it. When a
discussion grows a tail that is really a new question, open a new stub for the tail
instead of stretching the current one. The reverse also holds: a feature that lives in
several layers (API + UI for the same thing) is ONE decision, not one per layer.

**Order by dependency, not by domain.** For every stub write what it needs to be answered
first ("to answer this we need to know: 3, 5") and sort the tree topologically, so no
decision is presented before what it stands on. Domains are for grouping the reading, the
dependency order is for the discussion; the two often differ, and the discussion order wins.

**Flat numbering 1…N, given once.** No letters (1a/1b), no renumbering after a merge or a
drop — a DROPPED decision keeps its number and its stub with the reason. Numbers are the
reader's anchors; the moment they move, every earlier "→ 7" in the file and in the reader's head is wrong.

Create the living document with the "How it works" opener, the status table and ALL
decisions as PENDING stubs:

```markdown
# {Feature} — Architecture Decisions

Living document. Each decision is final unless a later decision forces us to revisit.

## How it works
(5-10 lines: the mechanism as decided so far — rewritten as decisions land)

| # | Decision | Status |
|---|---|---|
| 1 | Decision title | PENDING |
| 2 | Another decision | PENDING |

---

## 1. Decision title — brief description
**Status:** PENDING
**Answers:** which question of the user's this closes, one line
**Stands on:** — (or: 3, 5)

## 2. Another decision — brief description
**Status:** PENDING
**Answers:** …
**Stands on:** 1
```

The stubs serve navigation — when a decision references "→ 7", the reader can scroll and
see what 7 is about even before it's discussed. Never reference a decision that doesn't
have at least a titled stub.

**Build the storyboard "Life of one X" alongside the tree.** X is the thing the feature
is about (one file, one webhook event, one subscription). 4-7 scenes, each a moment in
X's life (born → stored → read → dies …); every decision is placed in the scene where it
is made, and decisions that fall outside X's life sit in a separate "Outside the life of
X" card strip, not forced into the story. It is a **local HTML file next to the ADR**
(`<topic>-storyboard.html`, in `.git/info/exclude` like the ADR), opened in the browser via
`file://` — not an artifact, nothing is published — and rewritten after every fixation
(Phase 4). Form, earned the hard way:
- scenes stacked vertically; in each scene the diagram first, full width, the text under it
- **the diagram is Mermaid**, one `<pre class="mermaid">` per scene, rendered by the pinned
  CDN script (`mermaid@10`, `startOnLoad`, `flowchart.useMaxWidth:false`, font ≥ 18px).
  Mermaid owns the geometry, so boxes cannot overlap and no screenshot check is needed —
  the session never hand-places boxes, arrows or SVG text
- a scene diagram carries the scene's one idea (the hinge node highlighted with a
  `classDef`), 3–7 nodes, labelled edges, full words — "Retention from plan" is a label,
  "Ret. frm plan" is a compression nobody asked for
- drawing the diagrams is delegated to the Mermaid agent (Ariel) when one exists. It gets
  the ADR file and the scene list — not a retelling of the mechanism; it reads and extracts
  it herself, that is what the agent is for. The session checks the labels against the ADR
  before assembling the page
- under every scene: decision chips ("Decisions 1 · 2 · 14"), "stands on" chips linking to the
  scene where the dependency lives, and a collapsed "Why so" (`<details>`) — empty until the
  decision is fixated

Forms that were tried and rejected — do not offer them again: a mermaid graph of the
decisions as the whole-picture device (Mermaid inside a scene is fine; a graph of 16
decisions is not); "all N decisions in one line" as a summary; a text-only "where we are"
checkpoint message; an artifact with hand-laid flex/SVG diagrams (every regeneration broke
the layout and cost a screenshot round). None of them let the user see the whole at the end.

Present the tree AND the storyboard to the user. Ask: "Is this everything we need to decide, or did I miss something?"

### Phase 4: Sequential discussion ("beads on a necklace")

Go through each decision in order. For each one:

**Present** — every decision message is self-contained; the user does not hold the
tree in memory, so a bare "7" means nothing to them:
1. Header: number **and** the block's title in plain words ("7. Where the retention
   length lives and how the bucket stays in sync")
2. One sentence: which problem of THEIRS this answers
3. What research/industry shows (if research was done); measure instead of guessing when a
   fact is cheap to get (an `EXPLAIN` on prod beats a debate)
4. A table of options with concrete, non-technical minuses — one message, one decision;
   explain any jargon the moment it appears
5. Your recommendation with reasoning, then the explicit ask ("Yes?") — one explicit yes fixates
   exactly one decision

The recommendation is mandatory: a menu without an opinion is useless.

**Discuss:**
- User asks questions — answer thoroughly
- User pushes back — accept facts, don't force-fit your theory
- User proposes something better — recognize it, adopt it
- User needs a concept explained — explain without condescension

**Fixate:**
When consensus is reached, update the document:

```markdown
## 1. Decision title — brief description
**Status:** DECIDED

**Decision:** [one-line summary]

[Key details — schema, algorithms, rules, format]

**Why not [alternative]:** [brief reason]
```

Keep fixated decisions concise but complete. Someone reading only the DECIDED sections should understand the full architecture.

After every yes, three more writes, same turn: the status table row flips; "How it works"
is rewritten if the mechanism changed; the storyboard scene that holds this decision gets
its "Why so" filled — a Y-statement ("In the context of …, we chose …, so that …") plus one
"Rejected: …" line per alternative — and the storyboard file is rewritten.
The story grows with the decisions, so at decision 14 the user still sees the whole of it.

Important: after fixating, check if this decision affects any already-decided sections.
If yes — do NOT silently rewrite them as DECIDED. Mark each affected one PROPOSED and
re-present it in the same format above; the user re-approves each one explicitly. A
pivot (e.g. a new mechanism replacing the issue's plan) can touch several earlier
decisions — walk through all of them. One yes fixates exactly one decision.
Cross-reference consistency is critical.

### Phase 4.5: Split if needed (skip for small features)

When no decision is left PENDING but before review — check if the document outgrew the single-file format (per "When to split" triggers above).

**Split process (delegate to general-purpose sub-agent — keeps main context clean):**

1. **Map sections to files** — group tightly related decisions, give each group a slug-name (`02-schema-source-of-truth.md`). Logical grouping > strict 1-to-1.
2. **Delegate the split** to a general-purpose sub-agent with explicit instructions:
   - Source file path + target directory
   - Per-section → file mapping table
   - Cross-reference conversion rules (`→ 7` → `[07-schema-source-of-truth.md](07-schema-source-of-truth.md)`)
   - Header template for each file (Status, Date, Issue, Related ADRs)
   - README template (index + status table)
   - **Content preservation is the prime directive** — instruct verbatim, no paraphrase
   - Verification checks: line count sum (original ≈ new total ± headers), key terms found in single files, no leftover raw `→ N` refs
3. **Accept** sub-agent output:
   - Spot-check 2-3 files including the largest one — read fully, compare against source
   - Run grep for remaining unconverted cross-refs and convert manually if missed
   - Delete the original combined file once split is verified

**Why delegate:** the split is mechanical (boundaries are pre-defined by headings, conversion rules are explicit) but verbose — keeping it out of main context saves room for the subsequent review phase (which iterates and can be lengthy) and implementation planning. The main agent retains decision-level knowledge; the sub-agent handles the carpentry.

### Phase 5: Review

When no decision is left PENDING (and split if applicable):

**Self-review:**
Read the entire document. Check for:
- Forward references that point to sections with different content than expected
- Decisions that contradict each other
- Details mentioned in one section but missing from another
- Edge cases mentioned in discussion but not captured in the decision

Wording, cross-references and formatting you fix yourself. Anything that changes what a decision says goes through the Phase 4 path — mark it PROPOSED and re-present it; the review phase does not get a quieter way to rewrite a DECIDED section.

**External review:**

Ask the user which reviewer fits this ADR (Agatha/Fable deep, Arthur/Codex, Dash/Sonnet, or a panel — their judgement of scale and stakes), then run it yourself with the brief below. This skill stays neutral on the choice; it does not stay neutral on skipping it.

**What the reviewer should look for** (pass this brief as the prompt context — adapt phrasing to the chosen tool):
1. Internal inconsistencies or contradictions between sections/files
2. Missing edge cases or failure modes
3. Architectural decisions that might cause problems at scale
4. Security gaps
5. UX issues for the target users
6. Anything underspecified that could cause implementation confusion
7. (Split ADRs) cross-file consistency — same concept described same way; cross-refs point where expected

**Iteration loop:** fix → re-review → fix until BLOCKING:0 twice in a row (typical ship signal). Every round gets the same neutral brief — never "verify prior fixes" priming; what may change between rounds is only the pointers to the document (see below), not the checklist.

**Processing reviewer feedback** point by point. For each:
- Valid → fix or add to the document
- Invalid (based on context the reviewer doesn't have) → explain why to user, skip

**Report review results to the user in plain words, one line per finding, in four buckets:**
"found / fixing myself / needs your yes / rejected and why". No reviewer jargon, no
severity codes as the headline — the bucket IS the headline. Only the third bucket costs
the user's attention; make it short and concrete.

When a review round changes a decision, move the brief's document pointers (which file,
which sections) to the new state before the next round — a stale pointer re-finds what was
already fixed. The "what to look for" list itself stays as it was.

**Empirically verify BLOCKING claims** before applying a fix — reviewers can be confidently
wrong, especially on Postgres internals, runtime behavior, regex matches, library version
specifics. A surprising BLOCKING claim is a hypothesis to test, not a fact to act on.

### Phase 6: Hand over to `/spec`

The ADR decides; it does not plan the work. Cutting phases, ordering them and writing
acceptance criteria is `/spec`, which reads this document as its input — so the ADR must
not contain a phase plan of its own (two plans drift). If the session ends here, `/handoff`
records that the ADR is closed, where it lives, and that `/spec` is next — nothing more.

## Principles

**Research grounds decisions.** "ChatGPT does X, Mem0 does Y, Letta does Z" is more convincing than "I think we should do X." Industry precedent prevents reinventing wheels and validates unusual choices.

**Consistency over speed.** Finishing all 18 decisions in one session is less important than each decision being internally consistent with the rest. If decision 12 invalidates decision 3 — go back and fix decision 3.

## Anti-patterns

- Starting to code before decisions are made ("I'll figure it out as I go")
- Discussing all decisions simultaneously instead of sequentially
- Making decisions without writing them down ("but we discussed it")
- Referencing "decision 7" without a stub → user has no idea what you mean
- Skipping external review ("it's fine as is")
- Over-researching a simple feature that needs 3 decisions, not 3 hours of research
- Letters in numbering (1a/1b) or renumbering after a merge — anchors must not move
- A stub that hides two choices; a "where is this decided? — in 7" jump with no stub to land on
- Reaching decision 12 with no picture of the whole — the storyboard exists so the end of the ADR still makes sense
- A decision graph, a one-line "all N decisions" summary or a text "where we are" as the whole-picture device — all three failed live

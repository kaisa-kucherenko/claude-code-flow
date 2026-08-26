# Workflows

## precogs.js — the review panel, orchestrated

[`precogs.js`](precogs.js) runs the three reviewers from [`../agents/`](../agents/)
— Agatha (Claude Opus), Arthur (Codex), Dash (Claude Sonnet) — **in parallel on
the same change**, then a synthesis agent dedupes their findings and
cross-votes them. Named after Minority Report: three precogs, one verdict.

The design decisions that matter:

- **Cross-voting over trust.** Every merged finding carries its vote (3/3,
  2/3, 1/3). A single-reviewer finding is marked "SINGLE-REVIEWER, verify" —
  lower confidence, not silent authority.
- **Cross-vendor agreement weighs more.** Agatha and Dash share the Claude
  lineage, so their agreement is less independent than agreement with Arthur
  (Codex). The synthesis is told so explicitly.
- **Debate mode** (`{ rounds: 2 }`): each reviewer sees the other two's
  round-1 findings and must CONFIRM / DISPUTE / CONCEDE each one — with peers
  labelled by persona name only, never by engine, so a finding is weighed on
  its merits, not on which brand raised it. Off by default (~doubles
  wall-clock).
- **The fast reviewer stays fast.** Dash gets explicit efficiency limits (no
  test suites, no worktrees, ~25 tool calls) — empirical verification belongs
  to the two deep reviewers; duplicating it made the fast pass slow for no
  extra signal.

## Install

Requires a Claude Code version with the Workflow feature, plus the three
reviewer agents from [`../agents/`](../agents/) (and the Codex CLI for
Arthur).

```bash
mkdir -p ~/.claude/workflows
cp precogs.js ~/.claude/workflows/
```

Then ask the session to run it: "run the precogs workflow on this diff" — or
pass args for scope/spec/debate, e.g. `{ scope: "PR #42 vs master", spec:
"docs/spec.md", rounds: 2 }`.

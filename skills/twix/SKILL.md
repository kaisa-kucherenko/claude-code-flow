---
name: twix
description: >
  Two-reviewer pass on the current diff, then one merged verdict — the house rules for every
  review panel live here. Presets: "твікс" / "/twix" = Agatha (deep Claude) + Arthur (Codex);
  "твікс лайт" / "twix light" = Arthur + Dash (fast, no Opus). Names in the trigger override the
  preset ("твікс Агата і Деш"). For the full three-reviewer panel with synthesis use the precogs
  workflow — it follows the panel rules below.
allowed-tools: Agent, Read, Grep, Glob, Bash(git diff:*), Bash(git status:*), Bash(git log:*)
---

# Twix — a reviewer pair on the diff

**Roster** — `твікс` = Agent `agatha` + Agent `arthur` (default); `твікс лайт` = Agent `arthur` +
Agent `dash`; two names in the trigger = exactly those two. `прекоги` = the `precogs` workflow
(`workflows/precogs.js` in this repo, installed per its README; args in its header). Roster and
synthesis come from the script; the rules below the script cannot enforce itself the calling
session supplies through its args — the scope with untracked names, the spec/ADR path, the
context. Its debate mode is a deliberate second round on the same findings, not a re-run after
patches; rule 5 applies to re-runs.

## Panel rules (shared by twix, precogs, /implement step 5)

1. **Scope** = uncommitted working-tree changes: `git diff HEAD` plus untracked files. `git diff`
   does not show untracked files and `git status --short` collapses a new directory into one line,
   so list them with `git status --short --untracked-files=all` and name every file in the prompt
   with "read these directly" — a reviewer that only diffs sees nothing and reports a clean
   change. The user may name another scope (PR, commit range, files). Put the exact git command
   and the untracked names in every prompt so they review the same thing.
2. **Launch all reviewers in ONE message** — parallel. Each prompt carries:
   - the scope command; what changed and why (they never see the conversation); the spec/ADR path
     if one exists;
   - where the project's packages live for API-signature checks (the service venv named in the
     project's `CLAUDE.md`, not system python);
   - severity buckets BLOCKING / IMPORTANT / NIT;
   - the explicit out: *"If a category is empty, say 'BLOCKING: none.' etc.; if everything is
     clean, say 'No issues found.' A clean review is a valid result."*;
   - *"An assumption about the environment stated in a comment (timezone of a column or process,
     encoding, locale, a default) is verified against the running environment or reported as
     UNVERIFIED — never confirmed by reading the comment."*
3. **Frozen tree** while they run — no edits, no stash, no checkout. Scratch goes to the scratchpad.
4. **Merged verdict**: dedupe, mark findings several reviewers raised, verify every BLOCKING
   against the code before accepting it — a surprising one empirically (run it, query it). Report
   in plain language, four buckets: found / fixing myself / needs your yes / rejected and why.
   Implementation-level fixes: the session applies them itself; ADR/product-level ones go to the
   user.
5. **Re-run only on the user's word**, with prompts byte-identical to the first pass — no
   "we fixed A, B, C, verify" priming.

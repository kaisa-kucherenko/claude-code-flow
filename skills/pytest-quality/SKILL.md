---
name: pytest-quality
description: The bar for pytest unit tests that can actually fail when the code is wrong — every test names the break it catches, expected values come from an independent oracle, fixture values discriminate between branches, mocks sit only at the external edge, and nothing is written for count or coverage. Preloaded by the test-writer and test-reviewer agents; load it too when writing or reviewing Python tests directly.
---

# pytest quality bar

A test earns its place by failing on a plausible bug. Count and line coverage are not goals:
a suite of ten tests that each catch a distinct break beats fifty that pass whatever the code
does, and every extra test is maintenance forever.

## 0. Project context comes first

Before anything else, read `.claude/testing.md` in the project root if it exists — run
command, asyncio mode, mock edge, conventions, gitignored files the tests need, traps. If it
does not exist, derive the same from `pyproject.toml` (`[tool.pytest.ini_options]`), the
`conftest.py` nearest the target, and two or three adjacent test files, and say in the
report that the project file is missing.
Project conventions override style preferences here; they never override sections 1–5.

Existing tests are not automatically the standard. A pattern this skill rejects (bare
`assert_called()`, `is not None` as the only check) stays rejected even if half the suite
does it.

## 1. The gate — before writing a test body

1. **Name the break.** State the production change that makes this test fail: wrong branch,
   wrong constant or argument, missing side effect, skipped validation, wrong boundary,
   empty/default return. Cannot name one → do not write the test.
2. **Bug or decision?** If only intentional decisions fail it (a constant's value, exact
   message wording, private structure), it is a change detector: it fires on redesign and
   sleeps through bugs. Test the behavior that depends on the decision instead.
3. **Independent expected value.** Literals and hand-checked fixtures. Never computed with the
   code under test, its helpers, or its constants — an oracle that shares the logic shares the
   bug. Never pasted from a run of the current code: that confirms the code matches itself.
   Characterization (pinning current behavior of legacy code) is allowed only when asked for,
   labeled as such in the test name or docstring, and each pinned value cross-checked against
   the raw input.
4. **Discriminating values.** Distinct, non-default inputs so a dropped, defaulted or swapped
   argument fails. When a value can come from several sources (default / config / explicit
   argument), give each a different value, or picking the wrong source still passes.
   `0`, `""`, `None`, empty and equal values are still covered when they are boundaries.

## 2. Choosing what to test

Derive cases from the contract — the task, spec, docstring, type hints, and how callers
actually use the code — not only from the branches of the implementation. Tests derived from
the implementation inherit its mistakes as "expected behavior".

- **Equivalence classes and boundaries:** one representative per class; at, just inside and
  just outside each threshold.
- **Error paths by injection:** make the dependency raise, time out, or return a partial or
  malformed payload, and assert what the code promises — propagate, retry, fall back, skip,
  log-and-continue. Do not invent a contract the code never made (a retry budget, a custom
  error type). If the failure behavior is unspecified, flag the gap; pin current behavior
  only as a labeled characterization test (§1.3).
- **State and repetition:** empty input, duplicates, a second identical call (idempotency),
  ordering — only where the code has such paths.
- **Async:** a failure in one of several gathered tasks, cancellation, timeouts — only where
  the code handles them.

Rate each candidate: **High** — catches a realistic production bug or guards complex logic;
**Medium** — documents important behavior or a past regression; **Low** — trivial, redundant
with an existing test, or tests the language/framework. Write High and the Medium that matter;
list the rest as not written, with the reason. Before writing, check whether an existing test
already fails for the same break.

## 3. Mocks and doubles

- Mock only the **external edge**: network, database, queue, browser, clock, randomness,
  slow filesystem. Fast deterministic internal logic stays real.
- Never patch a method of the unit under test or its private helpers — the assertion then
  reads the stub, not the unit.
- A mock earns no assertion by itself. Call verification as the only check is valid only when
  the interaction *is* the contract (publish, write, send, ack) — and then pin the arguments
  (`assert_called_once_with(...)`, `call_args`), never a bare `assert_called()`.
- A stubbed return must be a value the real collaborator can produce, in its real shape — all
  fields the code reads, realistic types. Prefer `autospec=True` / `create_autospec` so the
  double rejects calls the real API does not have.
- Mock setup taking more than half the test means the seam is wrong; say so rather than
  stacking more mocks.

## 4. Assertions

- Assert the exact values of the fields the behavior is about. `is not None`, truthiness,
  `len(x) > 0`, `isinstance` are never the only check.
- Text the code produces (messages, summaries, descriptions, prompts, report cards) is checked
  through the facts it must carry: numbers, names, identifiers, links, which sections or files
  are present or absent, each with a discriminating value. Never through sentences, labels or
  phrasing: they change with every copy edit and stay green when the fact behind them is wrong.
  A contract clause written in words ("the summary mentions the tabs") is tested through the
  structure that carries it, not by searching for the words. Exact wording is asserted only when
  the text itself is the contract: a protocol string, an error code, legally fixed copy.
- `pytest.raises(SpecificError, match=...)` wraps only the call under test, so a failure in
  setup cannot satisfy it. `match` targets the fact in the message (identifier, value, code),
  not the sentence around it.
- A filter, sanitizer or guard gets both directions: bad input rejected **and** good input
  preserved — a negative-only check passes when the output is empty.
- Order-insensitive comparison when order is not part of the contract.
- Floats: `pytest.approx` with a tolerance you can justify. Never widen a tolerance to get
  green.
- Several asserts in one test are fine when they describe one outcome.

## 5. pytest mechanics

- Follow the adjacent conventions: conftest fixtures, naming, file placement.
- Variations of one behavior → `@pytest.mark.parametrize` with `ids=`. Different behaviors →
  different tests.
- No logic in test bodies: no loops or conditionals computing expectations, no assertion that
  may never run.
- Deterministic: no `sleep`, wall clock, unseeded randomness, or live network. Isolation via
  `monkeypatch`, `tmp_path`, fixtures with teardown; no dependence on test order or on state
  another test left behind.
- No new dependencies. If a library would materially improve a specific test (Hypothesis for a
  round-trip or parser invariant), recommend it in the report with the bug it would catch —
  never add it.
- No test-only methods or flags in production code.

## 6. Proving a test can fail

A green run proves nothing until:

- **It was collected.** The file is under a collected path (check `testpaths`), the count in
  the output includes it — run `--collect-only -q` on a new file.
- **It ran.** `skipped` is not `passed`; a skip caused by an unreachable dependency means the
  test did not execute.
- **Async code was awaited** under the project's asyncio mode.

Then show it can go red:

- **Bug fix:** run the regression test against the unfixed code first when possible. Report
  the red run and the green run separately; if the red run was not observed, say so instead of
  claiming it.
- **Tests for existing correct code** may pass immediately — prove them with mutation instead.
- **Mutation check.** For each High test, mentally apply: flipped comparison (`>=`→`>`),
  wrong constant or argument, inverted branch, removed side effect, empty/default return,
  skipped validation. At least one test must fail for each realistic mutation.

  For the key branches, do it for real — in a throwaway copy of the repo, never in the working
  tree. The tree may hold uncommitted work, and someone may be editing the same file while the
  mutation is in place; a copy makes both harmless and leaves nothing to restore.

  ```bash
  # Copies abandoned by killed runs; the age limit spares a copy another run is still using
  find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'pytest-mutation.*' -mmin +120 -exec rm -rf {} +
  S=$(mktemp -d -t pytest-mutation.XXXXXX) && echo "$S"
  cd "$(git rev-parse --show-toplevel)"
  # Tracked + untracked-not-ignored files: uncommitted and new work is included; .git is not
  git ls-files -co --exclude-standard -z | rsync -a --from0 --files-from=- ./ "$S"/
  ```

  Shell variables do not survive between tool calls: take the path the `echo` printed and use
  it literally in every later step. An empty `$S` turns `"$S"/<file>` into a path at the root.

  1. **Baseline** inside `"$S"` with the project's own interpreter by absolute path (venvs are
     gitignored and are not copied). The result must match the same run in the repo. If it does
     not, a gitignored file the tests need is missing (see `.claude/testing.md`) — copy it in
     and rerun. Never mutate on a baseline that differs.
  2. **Isolation check.** A matching baseline does not prove the copy is what runs: an editable
     install (`pip install -e`, uv, poetry) resolves imports to the original tree. From inside
     the copy, the module under test must import from under the copy
     (`python -c "import <pkg>; print(<pkg>.__file__)"`). If it points at the repo, put the
     copy's source root first (`PYTHONPATH=<copy>/src`) and re-run the baseline.
  3. **One mutation at a time:** edit the file in `"$S"`, run the targeted tests, record which
     failed. Before the next mutation reset it from the original:
     `cp <repo>/<file> "$S"/<file>`.
  4. **Clean up:** `rm -rf "$S"` when done, also after a failed step, and state in the report
     that the copy was removed.

  The working tree is read-only throughout: no backup/restore, no `git checkout` / `restore` /
  `stash`. A test that hardcodes the absolute repo path, or an import that resolves to the
  original tree, reads the original, not the copy — mutations it seems to kill or miss prove
  nothing.

  A surviving mutant means an unprotected behavior (strengthen the test, or report it) — unless
  the mutation is equivalent (no observable change), which is not a finding.

## 7. The review ladder

Judge each test on these in order and report only the **first** that fails — later ones are
noise once an earlier one breaks:

1. **Does the assertion run?** Collected, not skipped, reached (not behind a conditional or
   after a return), awaited, not swallowed by `try/except`.
2. **Is the oracle independent?** Not computed by the unit, not echoing the stub's return, not
   copied from the current output.
3. **Is the real unit exercised?** Not a mock of the unit itself; not a patched core method.
4. **Does it verify enough?** Would a plausible wrong implementation still pass
   (`len(result) == 3` when the bug also yields three items)?
5. **Is it coupled to internals?** Breaks under a behavior-preserving refactor: private call
   order, exact SQL text, internal attribute names, the wording of generated text (§4).
6. **Does it pass in isolation and in any order?**

Not findings — do not flag:

- call-only assertions where the interaction is the contract and arguments are pinned;
- mocks on a genuine external edge;
- a deliberately narrow test whose scope the contract confirms;
- labeled characterization tests;
- a negative-only assertion on a filter whose contract is to drop everything.

A fix hint meets the same bar as the test: closing a gap with a wording-bound assertion trades
one weak test for another.

**Precision over recall.** A wrong High finding costs more than a missed Low one: it sends the
author to "fix" a correct test. Missing-test findings only for gaps that affect correctness or
the stated contract, each with the concrete failure it would catch — never tests for cases
that cannot happen.

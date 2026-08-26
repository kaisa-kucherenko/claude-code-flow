export const meta = {
  name: 'precogs',
  description: 'Three-reviewer panel — Agatha (Claude Opus, deep), Arthur (Codex), Dash (Claude Sonnet, fast) review the same change in parallel, then a synthesis agent dedupes findings and cross-votes them',
  phases: [
    { title: 'Review', detail: 'Agatha + Arthur + Dash in parallel' },
    { title: 'Cross-examine', detail: 'debate mode only — each reviewer reconciles peers\' findings (skipped without debate)' },
    { title: 'Synthesize', detail: 'dedupe, cross-vote, flag single-reviewer findings' },
  ],
}

// args reaches the script as a JSON string in this harness, not a parsed object — normalize first.
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch { A = {} } }
A = A || {}

const scope = A.scope || 'uncommitted working-tree changes (git diff HEAD)'
// Unknown arg keys are NOT silently dropped — they flow into the context block,
// so callers can pass focus/known_candidates/triage_policy/etc. freely.
const KNOWN_KEYS = ['scope', 'context', 'files', 'spec', 'rounds', 'crosscritique', 'debate']
const extraCtx = Object.entries(A)
  .filter(([k]) => !KNOWN_KEYS.includes(k))
  .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  .join('\n')
const context = [A.context, extraCtx].filter(Boolean).join('\n') || 'No extra context provided.'
const files = A.files || '(reviewers determine the files from the diff)'
const spec = A.spec ? `Spec/contract to verify against: ${A.spec}` : ''

// Cross-examination (round 2): each reviewer sees the other two's round-1
// findings and confirms/disputes/concedes them. Off by default — it ~doubles
// wall-clock. Enable with args { rounds: 2 } or { crosscritique: true }.
const rounds = Number(A.rounds) || (A.crosscritique || A.debate ? 2 : 1)

phase('Review')

const brief = `Review scope: ${scope}
${spec}
Context: ${context}
Key files: ${files}

Running tests: a "skipped" line on a DB-gated / integration test is NOT a pass — it almost always means the test's DB/env prerequisites weren't met (stub env vars, unsourced local config). Find the project's documented way to run them (e.g. CLAUDE.md "Running tests" / "backend tests"), which typically means sourcing a local env file and using the service venv before pytest. Prefer actually running the tests over reasoning about them; if you genuinely cannot, say so explicitly — never report skipped tests as passing.

Group findings by severity BLOCKING / IMPORTANT / NIT (shared scale). For each finding: file:line — the issue — a concrete fix. Be skeptical; a clean verdict is a valid result. Flag any finding whose validity depends on code you could not see.`

// Dash is the fast pass — a focused Sonnet review of the diff. Empirical work
// (test suites, builds, worktrees) belongs to Agatha/Arthur; duplicated runs
// made Dash ~2x slower than both on a real PR with no extra signal.
const dashLimits = `

--- EFFICIENCY LIMITS (this reviewer only) ---
- Do NOT run test suites, npm build, or other long-running commands — Agatha and Arthur handle empirical verification; write "not run (delegated to peers)" instead.
- Do NOT create git worktrees.
- Read the diff and open surrounding files only where a specific finding needs the context — do not tour the tree.
- Stay under ~25 tool calls.`

const [agatha, arthur, dash] = await parallel([
  () => agent(brief, { agentType: 'agatha', label: 'Agatha (Claude)', phase: 'Review' }),
  () => agent(brief, { agentType: 'arthur', label: 'Arthur (Codex)', phase: 'Review' }),
  () => agent(brief + dashLimits, { agentType: 'dash', label: 'Dash (Sonnet)', phase: 'Review' }),
])

const round1 = { agatha, arthur, dash }
let final = round1

if (rounds >= 2) {
  phase('Cross-examine')

  // Peers are labelled by PERSONA name (Agatha / Arthur / Dash), never by engine.
  // The models do not know which engine "Arthur" is, so this anonymises the brand
  // — a finding is weighed on its merits, not on who is "supposed" to be smarter.
  // Each reviewer re-runs in its own engine and reconciles against the others.
  const personaName = { agatha: 'Agatha', arthur: 'Arthur', dash: 'Dash' }
  const crossBrief = (selfKey) => {
    const peers = ['agatha', 'arthur', 'dash'].filter((k) => k !== selfKey)
    return `${brief}

--- CROSS-EXAMINATION (round 2) ---
Two other reviewers examined this SAME change independently. Their round-1 findings are below, labelled by name. Produce your own review of the change as usual, then reconcile it with theirs:
- For each peer finding: CONFIRM it (you agree — say why), DISPUTE it (you think it is wrong — cite the code), or CONCEDE it (you missed it — adopt it).
- Re-examine your own findings: RETRACT any you no longer believe; adjust severity where warranted.
- Do NOT agree just to converge. A real finding the others missed is valuable — defend it. Correctness is the goal, not consensus.
Tag each final finding CONFIRMED / DISPUTED / CONCEDED / RETRACTED / NEW, keeping the BLOCKING / IMPORTANT / NIT scale.

=== ${personaName[peers[0]]} (round 1) ===
${round1[peers[0]]}

=== ${personaName[peers[1]]} (round 1) ===
${round1[peers[1]]}`
  }

  const [agatha2, arthur2, dash2] = await parallel([
    () => agent(crossBrief('agatha'), { agentType: 'agatha', label: 'Agatha (cross-exam)', phase: 'Cross-examine' }),
    () => agent(crossBrief('arthur'), { agentType: 'arthur', label: 'Arthur (cross-exam)', phase: 'Cross-examine' }),
    () => agent(crossBrief('dash') + dashLimits, { agentType: 'dash', label: 'Dash (cross-exam)', phase: 'Cross-examine' }),
  ])
  final = { agatha: agatha2, arthur: arthur2, dash: dash2 }
}

phase('Synthesize')

const synthPrompt = `Three independent reviewers examined the SAME change. Different models and lenses (Claude Opus deep / Codex / Claude Sonnet fast) catch different classes of issue, and a single pass is unreliable — so cross-voting matters. Note: Agatha and Dash share the Claude lineage, so a finding both raise is less independent than one Arthur (Codex) also raises — weight cross-vendor agreement slightly higher.${rounds >= 2 ? '\nThese are their ROUND-2 positions: each has already seen the other two\'s round-1 findings and tagged them CONFIRMED / DISPUTED / CONCEDED / RETRACTED. Weight a DISPUTED finding lower and a multiply-CONFIRMED one higher; a RETRACTED finding is dead.' : ''}

Produce ONE synthesized report:
- Dedupe findings by file:line + root issue (the same bug worded differently = one finding).
- For each merged finding note the vote: how many of the three flagged it (3/3, 2/3, 1/3) and which reviewers.
- Group by severity BLOCKING / IMPORTANT / NIT.
- A finding caught by only ONE reviewer = lower confidence -> mark it "SINGLE-REVIEWER, verify". 2/3 or 3/3 = high-confidence.
- Preserve each reviewer's empirical-verification / lacked-context caveats — do not drop them.
- End with a one-line verdict: count of high-confidence BLOCKING/IMPORTANT, and whether the change is merge-safe.

Do NOT invent findings or inflate severity. If all three say clean, the verdict is clean.

=== AGATHA (Claude Opus, deep file-aware) ===
${final.agatha}

=== ARTHUR (Codex, file-aware CLI) ===
${final.arthur}

=== DASH (Claude Sonnet, fast focused pass) ===
${final.dash}`

const synthesis = await agent(synthPrompt, { label: 'Synthesis', phase: 'Synthesize' })

// Return raw verdicts alongside the synthesis so the caller can see each
// reviewer verbatim — the synthesis is an edit, not a replacement.
return { synthesis, raw_reviews: final, ...(rounds >= 2 ? { round1 } : {}) }
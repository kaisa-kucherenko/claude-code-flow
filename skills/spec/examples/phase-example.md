## Phase 1 — Quota store (2c)

**Goal.** One owner of quota data per page that any component can subscribe to. Today the
owner is `ChatInterface.tsx` (module-level cache + five scheduler effects inside the
component); the account block of phase 5 cannot reach it from there.

**Scope.**
- New store `stores/quota-store.ts` holding the raw `/api/usage/my-quota` payload as is
  (not the current 5-field mapper — `/usage` and `PricingCards` read a dozen fields);
  consumers derive. Zustand (already in the project — `ui-storage` is a zustand persist
  key); the requirement is that every consumer sees every update.
- Schedulers move with the state and become module-level: they start on the first
  subscription and are never torn down for the page's lifetime, so subscriber count never
  changes their cadence. 5-min interval, 1s post-stream refresh, `visibilitychange` with 10s
  throttle, the `app:quota-refresh` event, the 30s→5min retry ladder on exhausted quota with
  an overdue reset, 15s timeout, latch to `null` after 3 consecutive failures; the next
  scheduled tick or a manual `refresh()` issues a new request and a success clears the
  latch. Behaviour is 1:1 with today — this phase changes the owner, not the semantics.
- `refresh({ force })` bypasses the in-flight join; when two requests overlap, the
  last-issued one wins. Needed by phase 2 (`/usage` after a promo).
- Plan snapshot `{plan_key, plan_name, source}` under its own localStorage key (not
  `ui-storage`); **the key contains the user id**. It is a first-paint placeholder only:
  read once the user id is known (synchronously if the id is already available at store
  creation, otherwise on the first subscription that has it), always superseded by the
  first live response, written on every non-degraded response. Nothing is cleared on
  sign-out — the next sign-in reads its own key.
- Degraded response (`plan_name: "Unknown"`, `plan_key: ""`, `source: null`) is an explicit
  branch: it does not overwrite the snapshot; the store exposes `degraded: boolean` and
  phase 5 consumes exactly that field.
- The `'free'` constant (today `PLAN_FREE`, private in `QuotaNotice.tsx`) is exported from
  the store or a sibling module; `QuotaNotice` imports it from there.
- `ChatInterface.tsx` becomes a consumer: its local `useState`, `_quotaCache`, `_quotaFetch`,
  `sharedQuotaFetch` and the five effects are deleted.
- **Vitest lands here** — the first frontend code worth testing as logic. Node environment,
  no jsdom (the store renders nothing), `npm test` runs it. Tests in
  `stores/quota-store.test.ts`; network and storage are test doubles, never real. Seven
  scenarios, one `it` each:
  1. two concurrent `refresh()` → one request (single-flight);
  2. three consecutive failures → state `null`; the next scheduled tick succeeds → state restored;
  3. degraded response → snapshot in localStorage unchanged, `degraded: true`;
  4. snapshot written/read under a key containing the user id; a different user id → empty;
  5. `refresh({ force: true })` during an in-flight request → a second request, and the
     second result wins;
  6. exhausted quota with an overdue reset → retries at 30s, then backs off to 5min (fake timers);
  7. three `visibilitychange` events within 10s → one request (throttle, fake timers).
  Registration of the interval itself is wiring and is checked in the browser, not in a test.
- `frontend/CLAUDE.md` gets a **Testing** section with rules colleagues repeat rather than
  reinvent: (a) test logic — stores, helpers, visibility rules, allowlists; (b) do not test
  markup — no snapshot tests; component tests (Testing Library / `render`) off by default and
  need a written justification in the PR; visuals and click-flows belong to playwright;
  (c) `it.each` for rule tables; (d) test file next to its module as `*.test.ts`; (e) `fetch`
  is mocked, real network in tests is forbidden; (f) one scenario per test, named as a
  statement. Plus one example: `quota-store.test.ts` as the reference.

**Files.** `stores/quota-store.ts` (new), `stores/quota-store.test.ts` (new),
`components/ChatInterface.tsx`, `components/chat/QuotaNotice.tsx` (constant import only),
`package.json` + `vitest.config.ts` (new), `frontend/CLAUDE.md` (the "Quota state owner is
`ChatInterface.tsx`" paragraph → new owner; stores table; new Testing section).

**Edge cases.**
- Two `ChatInterface` mounts over the page lifetime (switching chats) — schedulers neither
  duplicate nor stop when one unmounts.
- A page with no chat consumer (`/usage`, `/pricing` in phase 2) — schedulers still run or
  start lazily on first subscription; implementer's call, but `/usage` must not gain an
  endless 5-min poll it never had.
- SSR: the store is created on the server too — localStorage access only in the browser, no
  hydration errors.
- Two accounts in one browser — account A's snapshot never renders for account B (key by user
  id). Where the user id comes from before the session resolves is the implementer's call
  (`useSession` already exists on the workspace); until the id is known the plan slot is
  empty, never someone else's.

**Acceptance.**
- Quota notices in chat behave exactly as before: appear on QUOTA_WARNING/EXCEEDED, refresh
  after streaming, retry after reset.
- Network shows one `/my-quota` request per event, not one per consumer.
- `grep -n "my-quota" components/ChatInterface.tsx` → empty.
- `frontend/CLAUDE.md` names the new owner; the old paragraph is removed, not duplicated.
- `npm test` green, 7 tests; no `jsdom` / `@testing-library` in `package.json`.

**Verify.** Test data: the local stack with quota enforcement enabled, one signed-in
user with a chat that has ≥3 conversations.
- Notices behave as before → `browser` 1280px light: send a message that crosses the warning
  threshold → the QUOTA_WARNING notice appears; after the stream ends the counter updates
  within 2s.
- One request per event → `browser` DevTools Network: switch tab away and back → exactly one
  `/my-quota` request; send one message → exactly one after the stream.
- No duplicate schedulers across mounts → `not testable locally` without instrumenting the
  store; covered indirectly by the "one request per event" line after switching 3 chats.
- `ChatInterface.tsx` no longer fetches quota → `unit`: `grep -n "my-quota"
  components/ChatInterface.tsx` → empty.
- CLAUDE.md names the new owner → `unit`: `grep -n "Quota state owner" frontend/CLAUDE.md`
  → one hit, pointing at `stores/quota-store.ts`.
- Tests → `unit`: `npm test` → 7 passed, 0 failed; `grep -E "jsdom|testing-library"
  package.json` → empty.

**Rollback.** Revert; the snapshot key left in localStorage is harmless garbage.


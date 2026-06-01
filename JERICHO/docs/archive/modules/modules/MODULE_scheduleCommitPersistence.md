# MODULE: Schedule Commit / Persistence

> **Source**: `src/state/identityCompute.js` **Audited**: Phase 1 closure /
> `autoAsanaPlan` boundary stabilization **Related**:
> `docs/scheduling_generate_plan_contract.md` **Phase 2 target**: Canonical
> block store refactor (Bucket 3)

---

## 1. Exported / public contract surface

There is no exported commit function. The entire commit path is internal to
`identityCompute.js` and is only reachable through the reducer switch.

| Entry point                                         | Type            | Caller                                                         |
| --------------------------------------------------- | --------------- | -------------------------------------------------------------- |
| `case 'APPLY_DRAFT_SCHEDULE'`                       | Reducer case    | External dispatch (store, UI, tests)                           |
| `applyDraftSchedule(state, payload)`                | Internal helper | `APPLY_DRAFT_SCHEDULE` case + `GENERATE_PLAN` auto-apply guard |
| `createBlock(state, payload)`                       | Internal helper | `applyDraftSchedule` only (in this path)                       |
| `setCycleProposedBlocks(state, cycleId, proposals)` | Internal helper | `applyDraftSchedule`, `GENERATE_PLAN`                          |

No function in this path is exported or testable in isolation. All testing must
go through `computeDerivedState` dispatch.

---

## 2. State reads and writes

### `applyDraftSchedule`

**Reads**:

- `state.proposedBlocks` — source of items to commit
- `state.activeCycleId` — fallback cycle resolution
- `state.cyclesById[cycleId]` — cycle lookup, `policyState`, `actions`
- `state.goalExecutionContract` — canonical contract fallback
- `state.appTime.activeDayKey`, `state.today.date` — current day resolution
- `state.planPreview.policySelectionDecision` — captured before apply for parity
  record
- `state.planDraft` — passed to `computePlanPreview`, then cleared
- `state.appTime.timeZone` — timezone for block writes

**Writes**:

- `state.proposedBlocks` — rewritten via `setCycleProposedBlocks` with
  `accepted` status
- `state.proposedBlocksByCycleId[cycleId]` — written via
  `setCycleProposedBlocks`
- `state.suggestedBlocks` — compatibility mirror, written via
  `setCycleProposedBlocks`
- `state.cyclesById[cycleId].proposedBlocks` — written via
  `setCycleProposedBlocks`
- `state.cyclesById[cycleId].suggestedBlocks` — written via
  `setCycleProposedBlocks`
- `state.today.blocks` — written via `createBlock`
- `state.cycle[*].blocks` — written via `createBlock`
- `state.currentWeek.days[*].blocks` — written via `createBlock`
- `state.executionEvents` — written via `createBlock` → `appendExecutionEvent`
- `state.suggestionEvents` — push per accepted item
- `state.planEvents` — push `DRAFT_POLICY_APPLIED` event
- `state.cyclesById[cycleId].policyState` — updated with applied policy
- `state.cyclesById[cycleId].lastPolicySelectionDecision` — recorded
- `state.cyclesById[cycleId].autoAsanaPlan` — cleared to `null`
- `state.cyclesById[cycleId].coldPlan` — reset to empty forecast shape
- `state.draftScheduleAppliedAtISO` — timestamp written
- `state.planDraft` — cleared to `null`
- `state.planPreview` — cleared to `null`
- `state.lastPlanError` — written on guard failures
- `state.scoreParity`, `state.policySelectionParity`, `state.pacingParity` —
  parity flags

### `createBlock`

**Reads**:

- `state.appTime.timeZone`
- `state.activeGoalId` — fallback goal linkage
- `state.activeCycleId` — fallback cycle linkage
- `state.executionEvents` — deduplication check via `canEmitExecutionEvent`
- `state.today.primaryObjectiveId`
- `state.today.summaryLine`

**Writes**:

- `state.today.blocks` — direct array append
- `state.cycle` — `ensureDay` insert/append
- `state.currentWeek.days` — `ensureDay` insert/append
- `state.executionEvents` — via `appendExecutionEvent`
- `state.lastSessionChange` — timestamp + type

### `setCycleProposedBlocks`

**Reads**:

- `state.cyclesById[cycleId].actions` — for canonical title resolution

**Writes** (all in one call):

- `state.proposedBlocks`
- `state.proposedBlocksByCycleId[cycleId]`
- `state.suggestedBlocks` ← compatibility mirror
- `state.cyclesById[cycleId].proposedBlocks`
- `state.cyclesById[cycleId].suggestedBlocks` ← compatibility mirror

---

## 3. Deterministic rules

**Guard sequence in `applyDraftSchedule`** — evaluated in strict order:

1. Cycle must resolve (`getTargetCycle` returns non-null) — else silent return
2. Contract must resolve (`getCanonicalCycleContract` returns non-null) — else
   silent return
3. Cycle must not be read-only (`isCycleReadOnly`) — else `CYCLE_READ_ONLY`
   error
4. Proposed items must include at least one `status === 'suggested'` block —
   else `NO_PROPOSED_BLOCKS` error (after `filter(Boolean)` fallback removed in
   Phase 1)

**`createBlock` guards** — evaluated per item:

1. `startISO` must be a valid ISO string — else skip item, call `assertValidISO`
2. `startDate` must produce a finite timestamp — else skip item
3. `canEmitExecutionEvent` deduplication check — else entire block creation is
   abandoned (block is not written to any slice)

**`setCycleProposedBlocks` normalization rules**:

1. Non-object proposals are skipped
2. Identity key is computed from
   `proposal.identityKey || proposal.id || synthetic compound key`
3. Duplicate identity keys are deduplicated (first occurrence wins)
4. Title resolves in priority order: canonical action title from cycle →
   `proposal.title` → `proposal.label` → empty string

**`createBlock` field resolution rules**:

1. Duration: `payload.durationMinutes` → `payload.durationMs / 60000` →
   `payload.duration / 60000` → clamped via `clampDurationMinutes`
2. Date: `dayKeyFromISO(startISO, timeZone)` → `deriveDateFromStart(startDate)`
   fallback
3. Status: `normalizeStatus(payload.status, surface)`
4. Domain/practice: `normalizeDomainValue(payload.domain || payload.practice)`
5. Origin: `payload.origin` → `'suggestion'` if `payload.suggestionId` present →
   `'manual'`
6. ID: `payload.id` → `nextDeterministicId(state, 'blk')`

---

## 4. Known failure modes

### F1 — No canonical block store: writes scatter across three view slices

**Severity**: High — Phase 2 / Bucket 3 blocker

`createBlock` writes the same block to `state.today.blocks`,
`state.cycle[*].blocks`, and `state.currentWeek.days[*].blocks` independently.
These are view-layer slices, not a single source of truth. Any mutation,
deletion, or update to a block must be applied to all three slices separately or
they diverge silently.

There is no reconciliation layer. If any slice write is missed — due to a guard
short-circuit, a date boundary condition, or a future refactor — the block
exists in some views and not others. No error is surfaced.

**Implication for Phase 2**: the canonical block store refactor must replace
these three independent writes with a single write to a canonical store, with
derived views computed from that store. Until then, every block mutation is a
scatter-write risk.

---

### F2 — Proposal state duplicated across five fields

**Severity**: Medium — maintenance and consistency risk

`setCycleProposedBlocks` writes the same normalized array to:

- `state.proposedBlocks`
- `state.proposedBlocksByCycleId[cycleId]`
- `state.suggestedBlocks` (marked "temporary compatibility mirror for 1.0.x")
- `state.cyclesById[cycleId].proposedBlocks`
- `state.cyclesById[cycleId].suggestedBlocks`

These five fields are always written together in a single call, so they are
consistent at write time. The risk is at read time: any code that reads from one
of these fields without going through the same write path will observe stale
state if a write is ever missed or partially applied.

The `suggestedBlocks` mirror is explicitly labeled temporary. It has not been
removed. As long as it exists, any test or UI code that reads `suggestedBlocks`
is coupled to the 1.0.x compatibility layer, not the authoritative field.

**Required action before Phase 2**: audit all read sites of `suggestedBlocks`
and `cyclesById[*].suggestedBlocks`. Migrate reads to `proposedBlocks`. Remove
the mirror write once read sites are migrated.

---

### F3 — Commit path coupled to preview recomputation and policy parity

**Severity**: Medium — complexity and testability risk

`applyDraftSchedule` does more than commit blocks. Before committing, it calls
`computePlanPreview` to recompute the preview state at apply time. It then
records policy parity signals, writes `DRAFT_POLICY_APPLIED` to `planEvents`,
updates `cycle.policyState`, and records `lastPolicySelectionDecision`.

This means a single `APPLY_DRAFT_SCHEDULE` dispatch:

- commits blocks to three view slices
- rewrites proposal status
- recomputes the plan preview
- records policy selection parity
- writes a plan event
- clears `planDraft` and `planPreview`
- resets `cycle.autoAsanaPlan` and `cycle.coldPlan`

The commit is not atomic in the sense that it can fail partway through. If
`computePlanPreview` throws or returns unexpected output, the policy parity
fields may be written in an inconsistent state while block writes have already
occurred. There is no rollback.

**Implication**: tests that assert only on committed blocks are not covering the
full state surface of `applyDraftSchedule`. The policy parity fields,
`planEvents`, and `policyState` updates are all untested by the Phase 1
rewrites.

---

### F4 — `canEmitExecutionEvent` deduplication silently abandons block creation

**Severity**: Medium — observability risk

In `createBlock`, if `canEmitExecutionEvent` returns false, the function returns
early without writing the block to any view slice. The block is not created. No
error is set on state. No log entry distinguishes "block was deduplicated" from
"block was never attempted."

This is a correct deduplication guard, but the silent return means a caller that
creates a block expecting it to appear in `today.blocks` will not detect the
failure. The only observable signal is the absence of the block from state.

**Required action**: `createBlock` should return a typed result indicating
whether the block was created or deduplicated. Callers in `applyDraftSchedule`
currently ignore the return value — they do not check whether each `createBlock`
call succeeded.

---

### F5 — `applyDraftSchedule` guard failures leave partial state

**Severity**: Low-medium — edge case with real surface

The first two guards (cycle resolve, contract resolve) return silently without
setting `lastPlanError`. If either fails, the caller has no signal beyond the
absence of committed blocks. The `CYCLE_READ_ONLY` guard does set
`lastPlanError`. The `NO_PROPOSED_BLOCKS` guard sets `lastPlanError`. But the
two pre-condition guards do not.

A silent return on cycle or contract resolution failure is indistinguishable
from a correct no-op (e.g. dispatching `APPLY_DRAFT_SCHEDULE` when there is no
active cycle by design). Tests that assert `scheduleApplied` or committed block
counts would catch this, but `lastPlanError` would remain null — giving a false
signal that nothing went wrong.

---

### F6 — `scheduleApplied` flag is never set in this path

**Severity**: Low — assertion gap

`scheduleApplied` is asserted in the Phase 1 test rewrites
(`expect(next.scheduleApplied).toBe(true)`). Reading the full
`applyDraftSchedule` source, this flag is **not written here**.
`draftScheduleAppliedAtISO` is written. `scheduleApplied` must be set elsewhere
in the `GENERATE_PLAN` path (likely in the auto-apply guard or a post-apply step
in the `GENERATE_PLAN` case itself).

**Required action before Phase 1 test assertions are considered stable**:
confirm where `scheduleApplied` is written and that it is set on every
successful commit path, including explicit `APPLY_DRAFT_SCHEDULE` dispatch (not
just the `GENERATE_PLAN` auto-apply path). If it is only set inside
`GENERATE_PLAN`, then `expect(next.scheduleApplied).toBe(true)` on an explicit
`APPLY_DRAFT_SCHEDULE` dispatch would pass only because `GENERATE_PLAN` set it,
not because `applyDraftSchedule` set it — making the assertion misleading rather
than precise.

---

## 5. Grade and required actions

| Concern                                       | Grade     | Reason                                                                                                   |
| --------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| Commit correctness (blocks written to slices) | 🟡 YELLOW | Correct behavior, but scatter-write architecture has no reconciliation layer                             |
| Proposal state consistency                    | 🟡 YELLOW | Five-field mirror is consistent at write time, fragile at read time                                      |
| Deduplication safety                          | 🟡 YELLOW | `canEmitExecutionEvent` guard is correct; silent failure on block creation is not                        |
| Commit boundary isolation                     | 🔴 RED    | Commit is folded into a multi-responsibility helper with no rollback                                     |
| `scheduleApplied` flag provenance             | 🔴 RED    | Not written in `applyDraftSchedule` — requires source trace to confirm correctness of Phase 1 assertions |
| Guard failure observability                   | 🟡 YELLOW | Two silent-return guards produce no error signal                                                         |
| Test coverage of commit side effects          | 🔴 RED    | Policy parity, `planEvents`, `policyState` updates are not covered by any Phase 1 test                   |

**Overall grade: 🔴 RED** Functionally operational. Architecturally fragile. Not
safe for Phase 2 refactor without resolving F1 (scatter-write), F4 (silent block
creation failure), and F6 (`scheduleApplied` provenance) first.

---

## 6. Required actions before Phase 2 / Bucket 3

Priority order:

1. **Confirm `scheduleApplied` write site** — locate where this flag is set,
   confirm it covers both auto-apply and explicit dispatch paths. If it does not
   cover explicit dispatch, the Phase 1 assertions are misleading and need a
   follow-up fix.

2. **Audit `suggestedBlocks` read sites** — grep all read sites of
   `state.suggestedBlocks` and `cyclesById[*].suggestedBlocks`. Migrate to
   `proposedBlocks`. Remove the compatibility mirror write from
   `setCycleProposedBlocks` once reads are migrated.

3. **Add typed return to `createBlock`** — return `{ created: true, block }` on
   success and `{ created: false, reason }` on deduplication or guard failure.
   Update `applyDraftSchedule` to check per-item results and surface a count of
   failed writes.

4. **Add `lastPlanError` to silent-return guards** — the cycle-not-found and
   contract-not-found paths in `applyDraftSchedule` should set `lastPlanError`
   with appropriate codes before returning.

5. **Design canonical block store interface** — define the write interface
   before touching `createBlock`. The scatter-write to three slices is
   load-bearing for current rendering. The replacement must be a compatible
   drop-in for the view layer or the Calendar Rendering module (Module 9) breaks
   simultaneously.

6. **Add commit side-effect tests** — `planEvents`, `policyState`,
   `suggestionEvents`, and `draftScheduleAppliedAtISO` are all written by
   `applyDraftSchedule` and are currently untested. These need coverage before
   the commit path is refactored.

---
name: phase-2-item-1-fresh-on-read-selector
description: Phase 2 Item 1 — Active/Scheduled loop selector with fresh-on-read constraint; root staleness bug fixed
metadata: 
  node_type: memory
  type: project
  originSessionId: 262aa901-6956-419a-b73b-905a416aa772
  modified: 2026-08-19T07:39:37.789Z
---

# Phase 2 Item 1: Fresh-on-Read Active/Scheduled Loop Selector

**Status**: Complete (Steps 1–3 done, Step 4 deferred as consolidation-only)  
**Commit**: f7f7c0af521ad4ee721d769cba82ff4c0777b5f8 (fresh-on-read selector module + tests + root-cause fix)  
**Date**: 2026-08-19

## What Was Fixed

**Root bug**: `recoverCanonicalContractForCycle` (identityCompute.js:8473–8548) was freezing fresh-computed `startDayKey` into state via two write-back paths:
1. Line 8505–8507: `repairedContract.startDayKey = contract?.startDayKey || startDayKey || null`
2. Line 8540–8541: `state.goalExecutionContract.startDayKey = state?.goalExecutionContract?.startDayKey || startDayKey || null`

Then `hydrateActiveCycleState` (line 2067–2070, runs on every `computeDerivedState` dispatch) copied this frozen value forward indefinitely. Result: `startDayKey` was accurate only at the instant `generatePlan` ran; every day after, every consumer read the frozen day instead of "today."

## Solution Architecture

**New module**: `src/state/engine/activeScheduledLoop.ts` — Pure selectors with fresh-on-read guarantee:

```typescript
resolveStartDayKey(cycle, contract, state, nowISO?, timeZone)
  → cycle.startedAtDayKey | contract.startDayKey | state.goalExecutionContract.startDayKey | dayKeyFromISO(nowISO)
  // NEVER null, NEVER cached, recomputed every call

resolveDeadlineISO(endDayKey, timeZone)
  → ISO timestamp at end of endDayKey (never null cache)

resolveActiveScheduledContract(cycle, state, nowISO?, timeZone)
  → { goalId, goalText, startDayKey (always fresh), endDayKey, deadlineISO, timezone }
  // Composes getCanonicalCycleContract + fresh time resolution

resolvePosInputs(cycle, state, nowISO?, timeZone)
  → { contract (fresh), startDayKey, activeBlocks, completedToday, completedTotal }
  // Rebuilds execution ledger snapshot fresh every call (matching executionContract.ts pattern)
```

**Key design constraint**: All return values are computed fresh on every call. No fields are stored on `state` or `cycle`. Takes explicit `nowISO` parameter (not wall-clock) for determinism.

**Pattern match**: `getCanonicalCycleContract` (cycleSelectors.js:205), `buildSnapshot` (executionContract.ts:11), `computeFeasibility` (feasibility.ts:80) — all existing, proven fresh-on-read patterns in the codebase.

## Changes Made

### Step 1: New selector module (src/state/engine/activeScheduledLoop.ts)
- 6 pure functions, 0 side effects, 0 memoization
- Explicit `nowISO` parameter for determinism (not `new Date()`)
- Composes `getCanonicalCycleContract` for goalId/text logic, layers fresh time resolution on top
- `buildExecutionEventSnapshot` mirrors `executionContract.ts` ledger-rebuild pattern

### Step 2: Regression test suite (src/state/engine/activeScheduledLoop.test.ts)
- 20 comprehensive tests covering:
  - **Time-passing axis** (4 tests): Verify `startDayKey` recomputes when `nowISO` advances without dispatch
    - Encodes exact bug: day N → day N+5 advance should give fresh N+5, not frozen N
  - **Event-ledger axis** (3 tests): Verify `completedToday` reflects appended events immediately
  - **Supportive tests** (13 tests): Contract resolution, deadline math, empty states, integration
- All 20 tests passing

### Step 3: Root cause fix (src/state/identityCompute.js)
- Lines 8505–8507: Removed `startDayKey`, `endDayKey`, `deadlineISO` from `repairedContract` object
- Lines 8540–8541: Removed `startDayKey`, `endDayKey` from `state.goalExecutionContract` write
- Added comment documenting why time-relative fields are removed (must derive fresh, not persist)
- **Kept**: `goalId`, `goalText`, `goalLabel` repair (legitimate one-time backfill, not time-relative)

## Verification

✅ **Step 1 (module creation)**: No tests required for pure, passive code.

✅ **Step 2 (regression test suite)**:
- All 20 tests passing
- Regression scenarios (time-passing staleness, event-ledger staleness) both verified

✅ **Step 3 (root cause fix)**:
- Step 2 regression tests: 20/20 pass (fix doesn't break the detector)
- Contract-adjacent tests: 31/31 pass
  - pos.trustState.lifecycle: 20/20 pass
  - scoring.pos.canonicalChain: 8/8 pass
  - goalPolicy.livePos.integration: 3/3 pass
- No unexpected regressions

## What's NOT Fixed (Deferred)

**Step 4 candidate (line 4532)**: Wiring `resolveStartDayKey` into `compileGoalEquationPlan` context.
- **Status**: Deferred, tracked as consolidation-only (not a correctness gap)
- **Reason**: Line 4532 reads `cycle.startedAtDayKey` directly. Never affected by the bug because `recoverCanonicalContractForCycle` writes to `cycle.goalContract.startDayKey` and `state.goalExecutionContract.startDayKey`, not `cycle.startedAtDayKey`.
- **Value of wiring**: Removes duplicate priority-resolution logic (selector does it once, centrally), but not required for correctness.
- **Blocker**: Module integration complexity (TS imports from JS context) + token budget. Pick up when a real TS-module-integration task touches this file anyway.

## Design Constraints Locked

From the user's Item 1 brief:

✅ **Fresh-on-read**: All exposed state (contract, startDayKey, deadlines) derived fresh on every read, never cached. Implemented via pure selectors with no internal state, explicit `nowISO` parameter, no memoization.

✅ **Eliminates staleness**: Directly kills the `recoverCanonicalContractForCycle` bug class by removing the ability to freeze a value into state. The selector recomputes on every call.

✅ **Isolation from Backlog**: Selectors never read `proposedBlocks` — backlog flows to Active/Scheduled only through explicit activation actions.

✅ **Isolation from Completed**: Selectors read `executionEvents` read-only (never mutate ledger), matching `executionContract.ts` pattern.

✅ **Determinism**: Only non-deterministic input is `nowISO`/`appTime.nowISO`, which is already the sanctioned "clock" everywhere else. No new wall-clock reads introduced.

## Files Created
- `src/state/engine/activeScheduledLoop.ts` (272 lines, pure selectors)
- `src/state/engine/activeScheduledLoop.test.ts` (354 lines, 20 tests)

## Files Modified
- `src/state/identityCompute.js` (recoverCanonicalContractForCycle: removed time-relative write-back at lines 8505–8507, 8540–8541)

## Next Steps (Phase 2 Items 2–6)

With Item 1 complete and selector proven:

- **Item 2** (Active/Scheduled → Scheduled flow): Uses selector for fresh startDayKey
- **Items 3–6** (backlog flow, narrative, nesting): Build on top of Item 1's foundation

See [[phase-2-items-2-6-three-stock-model]] for sequencing.

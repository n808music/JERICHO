---
name: e11-e12-root-cause-unwired-selector
description: "E11/E12 root cause: resolveBacklogBlocks selector defined but never wired into computeDerivedState; E11 needs wiring fix, E12 needs daysInBacklog calculation fix"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-22T01:53:58.564Z
  originSessionId: f91674bd-7c3b-4909-8f30-810747e7e052
---

# E11/E12 Root Cause: Unwired Selector

**Status:** ROOT CAUSE CONFIRMED VIA TOOL SEARCH

## Finding

**`resolveBacklogBlocks` is NOT called anywhere in the main derived-state computation paths:**
- identityCompute.js: zero calls
- identityStore.js: zero calls  
- computeDerivedState(): no selector integration

This is why E11 test fails: the incomplete block stays in today.blocks because the selector that should remove it is never invoked.

## Architecture Context

Production code comments describe the design intent (verified via direct grep):
- `flowIncompleteToBacklog.ts`: "Backlog membership is derived later via resolveBacklogBlocks() selector"
- `rollover.ts`: "Incomplete blocks are now derived to Backlog via resolveBacklogBlocks() selector"

**But:** The selector exists and works correctly (E12 tests call it directly), but it's not wired into the high-level API path.

## E11: Incomplete Block Not Removed from today.blocks

**File:** `src/core/__tests__/midnightRollover.test.ts`, line 127–163  
**Test:** "should apply rollover correctly in TICK_NOW action"

**What the test does:**
1. Calls `computeDerivedState()` with TICK_NOW action (day rollover)
2. Has an incomplete block (status: 'in_progress', placementState: 'COMMITTED') on the previous day
3. Expects the block to NOT be in result.today.blocks (it should flow to backlog)

**What actually happens:**
- The block stays in today.blocks
- The selector is never invoked, so backlog membership is never computed

**Fix required:** Wire `resolveBacklogBlocks(state)` into `computeDerivedState()` so that after rollover, incomplete blocks are removed from today.blocks.

## E12: daysInBacklog Off-By-One — TEST BRITTLENESS, NOT CALCULATION BUG

**File:** `src/core/engine/flowIncompleteToBacklog.test.ts`, line 397–411  
**Test:** "maintains daysInBacklog calculation when scope filtering"

**Test setup:**
- appTime.nowISO: '2026-08-21T12:00:00.000Z'
- appTime.activeDayKey: **MISSING** (not set in fixture)
- today.date: **MISSING** (not set in fixture)
- blockId 'block-1' has MISSED event on dateISO: '2026-08-19'
- Expects: daysInBacklog = 2

**Actual:** daysInBacklog = 3

**Root cause:** The selector computes `currentDayKey` via:
```typescript
const currentDayKey = state.appTime?.activeDayKey || state.today?.date || new Date().toISOString().split('T')[0];
```

Since the test provides neither `activeDayKey` nor `today.date`, it falls back to `new Date().toISOString().split('T')[0]`, which is the **actual wall-clock date when the test runs** (currently 2026-08-22).

Calculation:
- missedDate: 2026-08-19
- currentDayKey: 2026-08-22 (wall-clock fallback, not test's intended 2026-08-21)
- Difference: 3 days (2026-08-19 to 2026-08-22)

**This is test brittleness, not a code bug.** The test is date-dependent and fails when run on a different calendar day. This matches the known-flaky pattern already identified twice (Sunday placeholder, schedule.generate.nonSilent wall-clock dependency).

**Fix:** Add `appTime.activeDayKey: '2026-08-21'` to the test fixture to freeze the test date and remove wall-clock dependency.

## Related

[[e9-fix-BLOCKED-test-date-hardcoding]] — E9 fix is blocked until E11/E12 are cleared

## Next Steps

1. **E11 Fix:** Import and call `resolveBacklogBlocks()` in computeDerivedState, filtering out returned blocks from today.blocks during rollover
2. **E12 Fix:** Audit the daysInBacklog calculation in resolveBacklogBlocks.ts (likely an off-by-one in the date arithmetic)
3. **Verification:** Run full suite to confirm +2 tests fixed and baseline returns to 36

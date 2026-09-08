---
name: e11-e12-new-regressions-blocking-e9
description: "E11/E12: Two new test regressions on main (midnightRollover, flowIncompleteToBacklog) unrelated to E9, blocking E9 application and requiring investigation first."
metadata:
  type: project
  originSessionId: session_019SiVcPUeU6PEVKTjmdmYPJ
  modified: 2026-08-22T01:10:07.139Z
---

# E11/E12: New Test Regressions (Blocking E9 Application)

**Status:** DISCOVERED, UNRELATED TO E9, REQUIRE INVESTIGATION BEFORE E9 MERGE

## Summary

Name-level diff against frozen baseline (2026-08-07, 36 failures) revealed **+2 NEW test failures** on current main:

1. **E11: midnightRollover REGRESSION** — Rollover generating 1 extra execution event
2. **E12: flowIncompleteToBacklog REGRESSION** — Backlog day count calculation off by 1

Both are pre-existing on main (not caused by reverted E9 fix). Both require investigation before E9 can be cleanly applied.

## E11: midnightRollover.test.ts

**File:** `src/core/__tests__/midnightRollover.test.ts`  
**Test:** "Midnight Rollover > Integration with computeDerivedState > should apply rollover correctly in TICK_NOW action"

**Failure:** 
```
expected [ { id: 'block-1', …(7) } ] to have a length of +0 but got 1
```

Expected: 0 items in result  
Actual: 1 item

**Issue:** Rollover is generating an extra execution event or block when TICK_NOW action fires.

**History Note:** This test class was the cause of PR #20's massive revert (448-file bundle). Re-appearance of a midnightRollover regression warrants direct investigation, not dismissal.

## E12: flowIncompleteToBacklog.test.ts

**File:** `src/core/engine/flowIncompleteToBacklog.test.ts`  
**Test:** "Item 2: Flow incomplete blocks to Backlog on day boundary > Item 2: Scope filtering for resolveBacklogBlocks (2026-08-20) > maintains daysInBacklog calculation when scope filtering"

**Failure:**
```
expected 3 to be 2 // Object.is equality
```

Expected: daysInBacklog = 2  
Actual: daysInBacklog = 3

**Issue:** Scope filtering for resolveBacklogBlocks is affecting the day-count calculation incorrectly. Likely related to Item 2 (scope-params) merge.

## Blocked Work

- E9 application (waits for +2 regressions to be cleared)
- E10 bucket work (depends on E9 stability)
- Any scheduler/rollover fixes that depend on clean baseline

## Recommendation

1. **Investigate E11 (midnightRollover)** — Given PR #20 history, this gets high priority
2. **Investigate E12 (flowIncompleteToBacklog)** — Likely Item 2 side effect, trace to scope-params logic
3. **Once both fixed, re-run full suite** to verify baseline returns to 36 or documents newly-fixed tests
4. **Then apply E9 fix** with confidence that +1 expected variance from known-flaky tests is isolated

## Related

[[e9-fix-BLOCKED-test-date-hardcoding]] — E9 root cause confirmed, ready once E11/E12 cleared

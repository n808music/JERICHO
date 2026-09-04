---
name: e9-site7-inline-guard-validation
description: "E9 Site 7 validation — inline guard vs setAppTime tradeoff, baseline established"
metadata: 
  node_type: memory
  type: project
  date: 2026-08-22T03:50Z
  originSessionId: b755537e-0f88-49c4-92b8-84a3bc170178
  modified: 2026-08-22T15:34:47.845Z
---

# E9 Site 7: Inline Guard Implementation — Validation in Progress

## Problem Identified
Line 12778 in `identityCompute.js:routeGenerateSchedule()` computes fresh `runtimeNowISO` but discards it, using stale `state.appTime?.nowISO` instead. This breaks scheduler decisions for unpinned tests.

## Two Approaches Attempted

### Approach 1: Call `setAppTime()` (Rejected)
```javascript
setAppTime(state, {
  nowISO: runtimeNowISO,
  respectPin: true,
  mode: 'scheduler_input',
});
const nowISO = state.appTime.nowISO;
```

**Result:** +18 test failures (37 test files total, vs. expected 23)

**Analysis:** Mutating `state.appTime.nowISO` cascades to downstream logic in the same function:
- Line 12789: `nowDayKeyFromClock` recomputed from fresh value
- Line 12793: `effectiveViewAnchorDayKey` recomputed
- All subsequent scheduler constraints use fresh date instead of fixture date

**Why it matters:** Tests that use `routeGenerateSchedule()` indirectly (goal admission, cycle activation, etc.) got unexpected fresh dates in their scheduler constraints, breaking title generation and other logic.

### Approach 2: Inline Guard (Current)
```javascript
const nowISO = state.appTime?.timeIsPinned ? state.appTime.nowISO : runtimeNowISO;
```

**Rationale:** 
- Only affects `nowISO` variable used in scheduler input
- Does NOT mutate `state.appTime` globally
- Rest of function still uses stale fixture date for constraints (preserves test behavior for existing tests)
- Respects guard: pinned → fixture time, unpinned → fresh time

**Trade-off:** Creates inline reimplementation of guard logic (code duplication), but avoids cascading side effects.

**Documented as exception** with comment explaining why inline is preferable to `setAppTime()` at this site.

## Baseline Established
- **Original broken code** + new test cases: 37 failed | 4286 passed
- New test cases expect Site 7 fix: 2 new tests that fail without fix
- Running validation now with inline guard applied

## Next: Full Suite Results
Suite running to confirm:
1. Inline guard fixes the 2 new test failures (should drop to 36 or lower)
2. No new regressions introduced (vs. baseline 37)
3. Name-level diff to verify which failures resolved

## Design Decision: Inline vs. Helper

This site uses inline guard as documented exception because:
1. `setAppTime()` has global cascade effects unsuitable for this code path
2. The guard logic (if pinned, keep; else refresh) is simple and transparent
3. Better to be explicit at call site than hide side effects in a helper
4. Future maintainers see immediately why the decision was made

If `setAppTime()`'s logic changes, this site needs manual update — acceptable cost for avoiding cascade side effects.

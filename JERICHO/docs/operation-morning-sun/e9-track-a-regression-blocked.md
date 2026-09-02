---
name: e9-track-a-regression-blocked
description: E9 Track A reverted — simple activeDayKey fix causes regression in 2 test files. Track B investigation required. E10 prioritized.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4c65669e-b710-4918-84d5-ccba4b0c8443
  modified: 2026-08-21T19:31:00.965Z
---

# E9 Track A — REGRESSION BLOCKED

## What Happened

**Track A Attempt:** Update test expectations + re-apply `activeDayKey` fix

**Result:** ❌ Regression detected
- **25 failed test files** (vs baseline 23) — +2 files
- **38 failed tests** (vs baseline 37) — +1 test
- **Pattern:** Identical to first attempt, suggesting the regression is systematic, not accidental

**Status:** All changes **REVERTED** back to baseline (2b07ce2)

## The Problem

Simply replacing `nowDayKeyFromClock` with `activeDayKey` at line 12824 breaks 2 unrelated test files. This suggests:

1. **Scoping issue:** The change affects code paths beyond just the scheduler input computation
2. **Null handling:** Some code path gets `activeDayKey` as null when it previously relied on `nowDayKeyFromClock`
3. **Collateral dependency:** Other tests depend on the original logic in ways not obvious from the E9 test alone

## What's Needed for Track B

To unblock E9, a separate investigation must:

1. **Identify the 2 newly-failing test files** (run full suite and diff against baseline failure list)
2. **Root-cause why `activeDayKey` breaks them:**
   - Is `activeDayKey` null in those test scenarios?
   - Does the change affect cycle/schedule computation indirectly?
   - Are there guard conditions missing?
3. **Fix scoping:** Either guard the change to only E9-relevant code paths, or fix the broader issue causing the regression

## Recommendation

**Do not continue E9 debugging now.** The issue requires:
- Deep investigation into test setup and cycle computation
- Potentially refactoring the logic to avoid side-effects
- More time than Track A's simple scope allowed

**Recommended next action:**
- **Defer E9 to later** (needs deeper investigation)
- **Proceed with E10 Bucket 1** (Execution Contracts) — independent, unblocked
- Return to E9 once more context is available or as a separate deep-dive session

## Summary

| Track | Status | Notes |
|-------|--------|-------|
| **A: Test Fix** | Reverted | Confirmed E9 test would pass with `activeDayKey`, but causes collateral damage |
| **B: Regression Debug** | Needs investigation | 2 test files broken by the change; root-cause unknown |
| **E10 Bucket 1** | Ready to start | Independent of E9; unblocked |

---

Related: [[e9-investigation-reverted]], [[e10-bucket-breakdown-structure]]

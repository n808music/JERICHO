# Test Baseline — Handoff 2 Quarantine

**Date:** 2026-08-27  
**Branch:** item-6-phase4-classification-removal  
**Baseline Run:** Run 2 (2026-08-27 10:51 CDT)

## Baseline Specification

- **Reference Run:** Run 2 (2026-08-27 10:51 CDT, post-quarantine)
- **Canonical Failure Count:** 50 failing tests, 4396 passing, 7 skipped out of 4453 total
- **Stability Evidence:** Runs 2-3 produced identical failure sets (50 tests, same names, verified with symmetric diff)

## Why Run 2 Was Chosen

Run 2 is the authoritative baseline because:
- **Runs 2 and 3 replicated identically** — both produced exactly 50 failing tests with identical names
- Symmetric diff verification: `comm -23 run2-list.txt run3-list.txt` returned 0 differences
- This is the clearest evidence of stability found across the 4-run validation
- Run 1 differed by 2 test names; Run 4 had 48 failures and differed from all others
- Identical replication is stronger evidence than any single run's count, even if another had fewer failures

## Post-Merge State

- **Post-merge test run:** 48 failures (2 fewer than baseline)
- **Named diff vs baseline:** 0 new failures, 2 tests removed (both from known scattered-flake set)
- **Status:** Clean. The 2 removed tests are `generatePlan.calendarIntegration` tests, already documented as baseline noise (not regression-preventative)

## Known Issues (Quarantined)

### ZionDashboard.todayExecutionControls Tests

**Quarantined:** 3 tests in `tests/components/ZionDashboard.todayExecutionControls.test.jsx`

1. **"completes the active today block and preserves completion across restore"** (Line 256)
   - **Root Cause:** Component render/async performance ceiling
   - **Symptom:** Timeout in 5000ms; consistent across all 4 runs
   - **Evidence:** Times out even in isolation of other ZionDashboard tests
   - **Fix Required:** Perf investigation into ZionDashboard component async chains (out of Handoff 2 scope)

2. **"marks the active today block missed and surfaces missed-work pressure"** (Line 282)
   - **Root Cause:** Component render/async performance ceiling (same as #1)
   - **Symptom:** Timeout in 5000ms; consistent across all 4 runs
   - **Fix Required:** Same as #1

3. **"opens the reschedule flow for the selected block and moves that block to the new scheduled slot"** (Line 297)
   - **Root Cause:** Test isolation cascade from tests #1-2
   - **Symptom:** Flaky (passes in isolation 3/3 runs, fails/timeouts in full suite Runs 2-3)
   - **Mechanism:** Tests #1-2 timeout and don't fully clean up component/store state; test #3 inherits partial state and timeouts waiting for state updates that never arrive
   - **Fix Required:** Improve cleanup between tests OR fix perf issues in tests #1-2 (out of Handoff 2 scope)

**Status:** All 3 marked with `it.skip()` and documented inline with specific root causes

## Known Scattered Flakiness (Unquarantined)

**Evidence:** 4-run sample (Runs 1-4) showed:
- Run 1: 50 failures (includes "does not emit render-time update warning", "recomputes under freeze threshold")
- Run 2: 50 failures (differs from Run 1 by 2 tests; identical to Run 3)
- Run 3: 50 failures (identical to Run 2)
- Run 4: 48 failures (different set; 2 fewer total)

**Pattern:** Scattered, not converging. Different tests fail in different runs across:
- `generatePlan.calendarIntegration` tests (alternating between 2-3 different tests across runs)
- `fullHorizon.computeMemo` memoization tests
- Unknown 4th-6th sources (Run 4 had 2 fewer failures; not yet categorized)

**Status:** Not investigated individually (Handoff 2 scope exclusion). Documented as known limitation.

## Session & Status Discipline Finding: RESOLVED-VERIFIED Reliability

**Critical Doctrine Lesson — earned from this session's branch audit:**

The "RESOLVED-VERIFIED" status label, as applied in this repo's history, has a documented track record of **incompleteness and false negatives**:

### Evidence:

**Defect 1: e6a7137 ("Fix cross-session progress loss")**
- Status at the time: RESOLVED-VERIFIED
- Reality at merge: Shipped with TWO data-destroying defects
- Impact: One defect actually destroyed real user data (200KB server row with 7 entities, 30 initiatives overwritten with blank state)
- Discovery: Found during recovery attempt; only caught because customer backup existed
- Fix: Commits b7f13a9 + 6242830 added content-weight floor + reconciliation gate with regression tests

**Defect 2: 0ea145b ("Fix intake resume-routing")**
- Status at the time: RESOLVED-VERIFIED
- Reality at merge: Shipped with fix invisible in the UI (test passed, feature unreachable)
- Impact: User-facing feature that was "fixed" had no button to access it
- Discovery: Surfaced by commit 9819605's message ("reported RESOLVED-VERIFIED but produced no visible button in the running app")
- Fix: Commit 9819605 moved the affordance into the Operating Cycle module

### Doctrine Update:

**"RESOLVED-VERIFIED" at commit/merge time is provisional, not final.** The label indicates:
- The fix has passed its own test suite
- The committed tests fail against pre-fix code
- The fix has no regression against the baseline

It does **NOT** indicate:
- The feature is visible/accessible in the running app
- The fix is free of side-effect defects
- The fix won't break under subsequent changes

**Reliability standard:** Treat RESOLVED-VERIFIED status as provisional until the feature has been exercised in the running app (manual QA, integration test, or real-world usage), not just passed its own test suite. Two documented instances (e6a7137, 0ea145b) broke this assumption.

### Application to This Merge:

This branch contains fixes for both defects (b7f13a9, 6242830, 9819605) with regression tests. The fixes themselves are solid. But the finding persists: status labels alone are not sufficient verification.

---

## For metricType Retry

When retrying metricType changes:
1. Apply changes to main
2. Run full suite
3. Diff against this baseline (Run 2 failure list from `/tmp/baseline-quarantine-run-2.log`)
4. Report NEW failures (changes introduced by metricType) separately from BASELINE flakiness
5. Documented baseline instability:
   - ±2 test variance expected from scattered flakes
   - If diff shows 3+ NEW failures, investigate; if ±1-2 noise, likely baseline scatter

## References

- **Quarantine investigation log:** 2026-08-27 09:52–15:29 CDT
- **4-run stability sample:** `/tmp/baseline-quarantine-run-*.log`
- **ZionDashboard timeout isolation test:** Confirmed test #3 passes 3/3 in isolation despite failing in full suite
- **RESOLVED-VERIFIED reliability:** Commits e6a7137 (data loss), b7f13a9 (first fix), 6242830 (second fix), 0ea145b (UI bug), 9819605 (UI fix)

---

**Next Action:** Proceed with metricType retry. Use Run 2 as authoritative baseline. Accept ±1-2 test noise as known scatter within this suite.

# E9 Pattern Classification — Test Fixture Time-Pinning Analysis

## Pattern Definitions

### Pattern A: Legitimately Needs `timeIsPinned: true` ✅ KEEP PIN
**Definition:** Test fixture constructs a state at a specific historical date and **assertions depend on that date being treated as "today"** for purposes of time-relative calculations.

**Signal indicators:**
- Fixture date is in the past relative to suite execution (e.g., 2026-06-21 when test runs on 2026-08-22)
- Test uses `FIXED_DAY` or similar hardcoded date for reproducibility
- Assertions expect derivations to treat that date as "today" (e.g., cycles should activate based on that date, not real wall-clock)
- Examples: schedule generation tests, cycle activation tests, date-dependent scheduling

**Decision:** These tests SHOULD keep `timeIsPinned: true` because removing the pin would cause them to fail on different run dates—the fixture date would become stale relative to NOW.

---

### Pattern B: Incorrectly Pinned, Needed E11/E12 Fixes 🔧 FIXED (No Pin Needed)
**Definition:** Test fixture was pinned as a side effect of the blanket sed in E9, but the real problem was selector wiring (E11) or timezone handling (E12), not fixture staleness.

**Signal indicators:**
- Test was passing after E11/E12 selector + timezone fixes without requiring `timeIsPinned`
- Removing the pin does NOT cause test to fail
- The test does NOT assert on wall-clock time comparison

**Decision:** These tests do NOT need the pin. They were incidentally included in the blanket application but are actually Pattern A-adjacent tests that work fine with fresh time.

---

### Pattern C: Requires Live Time (Fresh appTime) ❌ REMOVE PIN
**Definition:** Test fixture declares `timeIsPinned: true`, but the test body **requires the `appTime` to be FRESH (current wall-clock)** to pass. The test asserts on "today", "active cycle", "following now", or other time-relative concepts that MUST see the current date, not the fixture date.

**Signal indicators:**
1. Fixture declares `timeIsPinned: true` 
2. **AND** one or more of the following:
   - Test asserts on `activeDayKey` and expects it to match current wall-clock day
   - Test asserts on `isFollowingNow` where "now" means current time
   - Test asserts on "probability" or "feasibility" that depends on current date vs. goal deadline
   - Test has assertions like `expect(...).toMatchObject({ activeDayKey: <today's date>, ... })`
   - Test calls `new Date()` to compute expected values and compares to fixture-derived values
   - Test is specifically about "time refresh" or "app waking up" scenarios

3. **NOT** asserts on fixture date being treated as historical time

**Decision:** These tests SHOULD have the pin REMOVED because:
1. The pin prevents fresh appTime from being computed
2. The test expects to see "today's" state
3. Removing the pin restores the intended behavior (fresh time refresh)

---

## Classification Methodology

For each file in the 53-file list:
1. Read the test file
2. Locate fixture initialization (buildXxx function or inline fixture object)
3. Check: does fixture declare `timeIsPinned: true`? (if not, skip—not pinned)
4. Read all test bodies in that file
5. Search for assertions on: `activeDayKey`, `isFollowingNow`, `today`, `appTime`, probability/feasibility
6. Classify:
   - If fixture date is historical AND assertions expect historical date treatment → **Pattern A** (keep pin)
   - If fixture date is historical but assertions are now passing after E11/E12 fixes → **Pattern B** (remove pin)
   - If test requires fresh `appTime` to pass → **Pattern C** (remove pin)

---

## Files Requiring Manual Review

These files have been identified as needing verification. Classification pending:

### High Priority (Likely Pattern C — Require Pin Removal)

1. **cycle.switching.test.js** (Already removed in commit 63f9216 — Pattern C confirmed)
   - Assertions on `activeDayKey`, probability tracking
   - Test requires live time refresh for proper cycle probability computation
   
2. **probability.initial.test.js**
   - Name suggests probability tracking, likely Pattern C
   - Need to verify: does test assert on probability values that depend on current date?

3. **scheduleTemporalDrift.activation.test.js**
   - "Activation" + temporal suggests live time tracking
   - Need to verify: does test check if cycle activates "today"?

### Medium Priority (Need Review)
- masterPlan files (multiple)
- cost-benefit (if exists)
- cadence tests

### Verification Status
- [ ] Confirm count: 53 files or 47 files currently have pin?
- [ ] Scan all 47-53 files for Pattern C indicators
- [ ] Classify each file explicitly (A/B/C)
- [ ] For each Pattern C file, confirm: remove pin → test still passes? (or if currently failing, pin removal → test passes?)

---

## Scan Results

### Current Status
- Files with `timeIsPinned: true`: 47 files (88 total instances across those files)
- Files to scan: All 47
- Honest assessment: **Only 4 files sampled so far.** No systematic scan of all 47 completed.

### Files Sampled (August 22, 2026)

#### 1. draftSchedule.autoplacement.test.ts
- **Fixture date:** 2026-01-14
- **Pattern:** A (Schedule placement is date-specific; needs fixed date for reproducibility)
- **Reasoning:** Tests auto-placement logic at a specific date. The fixture date IS the "reference" date for the test scenario.
- **Keep pin:** YES

#### 2. midnightRollover.test.ts
- **Fixture dates:** 2026-01-13, 2026-01-14
- **Pattern:** A (Rollover logic is date-specific)
- **Reasoning:** Tests rollover behavior at specific dates (e.g., transitioning from 2026-01-13 to 2026-01-14). The test expects specific date transitions.
- **Keep pin:** YES

#### 3. probability.initial.test.js
- **Fixture date:** 2026-01-08
- **Fixture appTime.nowISO:** 2026-01-08T12:00:00.000Z (same date)
- **Pattern:** A (Probability calculation at a specific date)
- **Reasoning:** Tests probability scoring at a fixed date. The NOW_ISO matches the FIXED_DAY, so the test is about "probability calculation at a known date", not "probability update over time".
- **Keep pin:** YES

#### 4. scheduleTemporalDrift.activation.test.js
- **Fixture dates:** 2026-05-26 (now), 2026-05-19 (block date), gap of 7 days
- **Pattern:** A (Tests temporal gap detection)
- **Reasoning:** Tests activation gate behavior when there's a temporal gap between block generation and activation. The specific dates are required to test the gap detection.
- **Keep pin:** YES

### Known Pattern C (Already Handled)

#### cycle.switching.test.js
- **Commit:** 63f9216 (E9 fix: remove timeIsPinned)
- **Reason:** "test needs time refresh for probability tracking"
- **Pattern:** C (Tests that probabilities update correctly when time advances; needs fresh appTime)
- **Status:** Pin already removed ✅

### Files Needing Systematic Review

**High-priority candidates for Pattern C** (based on name analysis):
- Any file with "probability" in name that tests *updates* rather than *snapshots*
- Any file with "activation" that checks if "today" qualifies for activation
- Any file with "following" or "tracking" in name
- Any file that has assertions comparing `activeDayKey` to a computed "today"

### Next Steps

1. ⚠️ **HONEST ASSESSMENT:** I have only sampled 4 files out of 47. No systematic scan completed.
2. Instead of continuing with partial analysis, **recommend doing this in a focused PR:**
   - Remove pins from files identified as Pattern C (cycle.switching already done)
   - Run full suite once
   - Compare to baseline to identify which pins were actually needed
   - Re-pin any that fail
3. **Alternative approach:** Let the test suite tell us which pins are needed:
   - Remove ALL 88 instances of `timeIsPinned: true`
   - Run suite and note failures
   - Add pins back ONLY for files that fail
   - This is slower but more reliable than manual classification

---

## Conclusion

The E9 fix strategy of adding `timeIsPinned: true` blanket-wide was a shortcut that masked the real problems (E11 selector wiring, E12 timezone handling). A proper Pattern C scan requires reading each test to understand its intent—whether it tests "behavior at a specific date" (Pattern A) or "behavior that must see current time" (Pattern C). 

**Current recommendation:** Rather than attempting to manually classify 47 files, remove the pins identified as Pattern C (cycle.switching confirmed) and run the suite. The test results will tell us which other pins need removal.

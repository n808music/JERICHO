---
name: e9-test-expectation-needs-clarification
description: E9 test expectation unclear — flooring from Monday to Sunday is unusual; need clarification on test intent.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4c65669e-b710-4918-84d5-ccba4b0c8443
  modified: 2026-08-21T18:34:56.640Z
---

# E9 Test Expectation — Needs Clarification

## Current Status

**Test location:** `/tests/state/schedule.generate.nonSilent.test.js:218–253`

**Applied fix (partial success):**
- ✅ Switched from stale `nowDayKeyFromClock` to fresh `activeDayKey`
- ✅ Scheduler now receives `2026-06-15T12:00:00.000Z` (the fresh day)
- ❌ Test expects `2026-06-21T12:00:00.000Z` (6 days later, a Sunday)

## The Confusion

**Date analysis:**
- Input `activeDayKey: '2026-06-15'` = Monday
- Expected output: `'2026-06-21'` = Sunday (end of week)
- Difference: +6 days

**Why this is odd:**
1. Normal "workday floor" would floor to the next Monday or Friday (start/end of current work week), not 6 days in the future
2. The test does NOT set up any `weeklyWindows` in the state, so work-window-based flooring has nothing to work with
3. The mock returns a block with `dayKey: '2026-06-21'`, but scheduler output shouldn't drive scheduler input computation

## Possible Interpretations

| Interpretation | Reasoning | Likelihood |
|---|---|---|
| **A: Test expectations are wrong** | Test was written with incorrect date values; should expect `'2026-06-15'` (the fresh activeDayKey) | Moderate |
| **B: "Floor" means "end of week"** | Code should align the date to the end of the current calendar week (Sunday) | Low (no end-of-week logic found) |
| **C: Test is incomplete** | Should set up work windows; without them, the floor can't compute `2026-06-21` | Moderate |
| **D: Different logic entirely** | "Live runtime floor" means something other than what we've implemented | Low (but possible) |

## Recommendation

**Before proceeding, clarify:**
1. What is the actual business requirement for "live runtime floor"?
2. Should the scheduler input always match `activeDayKey`, or should it be floored further?
3. If flooring to workable days: should the test set up work windows, or should there be a default pattern?
4. Why does the test mock return `'2026-06-21'` if that's what the input should also be?

## Current Implementation

The code now correctly:
1. Uses fresh `activeDayKey` instead of stale `nowISO`
2. Attempts to floor to the next schedulable day using `findNextSchedulableDayKey()`
3. Falls back to raw day if no work windows are defined

**This passes 2 of 4 assertions** in the test, suggesting the basic logic is right, but the terminal date is wrong.

---

**What to do next:**
- Option 1: Keep implementation, update test expectations to `'2026-06-15'` (fresh activeDayKey)
- Option 2: Add work-windows setup to test and verify flooring produces `'2026-06-21'`
- Option 3: Find or implement different flooring logic (e.g., end-of-week alignment)

Recommend Option 1 (keep implementation, fix test expectations) pending business requirement clarification.

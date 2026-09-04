---
name: e9-root-cause-and-fix
description: E9 root cause identified and fix strategy — apply workday-floor to scheduler input via findNextSchedulableDayKey.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 4c65669e-b710-4918-84d5-ccba4b0c8443
  modified: 2026-08-21T18:27:48.806Z
---

# E9 — Root Cause & Fix Strategy

## Root Cause (Verified)

**Location:** `src/state/identityCompute.js:12824–12830` in `generatePlan()`

**Current code:**
```javascript
const schedulerStartDayKey =
  maxDayKey(nowDayKeyFromClock, contractStartDayKey) ||
  contractStartDayKey ||
  nowDayKeyFromClock ||
  effectiveViewAnchorDayKey ||
  nowDayKey(timeZone);
const anchorNowISO = `${schedulerStartDayKey}T12:00:00.000Z`;
```

**Problem:** `schedulerStartDayKey` is computed from the raw day keys WITHOUT flooring to a workable/schedulable day. The test asserts that the scheduler input should use a "live runtime floor" — meaning the scheduler should receive a day that has actual work windows available.

## Test Requirement (Line 218–253 of `tests/state/schedule.generate.nonSilent.test.js`)

**Test name:** "passes the live runtime floor to the scheduler instead of a stale persisted May 19 contract start"

**Input state:**
- `appTime.nowISO = '2026-05-19T12:00:00.000Z'` (STALE)
- `appTime.activeDayKey = '2026-06-15'` (FRESH)
- `goalContract.startDayKey = '2026-05-19'` (STALE)

**Expected scheduler input:**
- `compileInput.nowISO = '2026-06-21T12:00:00.000Z'` (floored to workable day)
- `compileInput.constraints.cycleStartDayKey = '2026-06-21'` (floored)

**Key insight:** The date `2026-06-21` is NOT from input directly. It's the result of flooring the computed `schedulerStartDayKey` to the next day with available work windows.

## Fix Strategy

**Function to apply:** `findNextSchedulableDayKey(startDayKey, workWindows, timeZone)` (already exists at line 5357)

**Available at line 12824:** `weeklyWindows` (computed at line 12627) contains the work-window data needed

**Proposed change (line 12824–12830):**

```javascript
const schedulerStartDayKey =
  maxDayKey(nowDayKeyFromClock, contractStartDayKey) ||
  contractStartDayKey ||
  nowDayKeyFromClock ||
  effectiveViewAnchorDayKey ||
  nowDayKey(timeZone);

// NEW: Floor to next schedulable day before passing to scheduler
const flooredSchedulerStartDayKey = findNextSchedulableDayKey(
  schedulerStartDayKey,
  weeklyWindows,
  timeZone
) || schedulerStartDayKey; // Fallback if no schedulable day found

const anchorNowISO = `${flooredSchedulerStartDayKey}T12:00:00.000Z`;
```

## Implementation Checklist

- [ ] Apply the fix above to lines 12824–12830
- [ ] Also update `cycleStartDayKey` constraint: check line 12950 (if exists) to use `flooredSchedulerStartDayKey` instead of raw
- [ ] Run test: `npx vitest run tests/state/schedule.generate.nonSilent.test.js -t "passes the live runtime floor"`
- [ ] Full suite: `npm test`
- [ ] Verify zero regressions (current baseline: 37 failures)

## Related

- [[e9-test-requirement-verified]] — test decoded
- [[e9-scheduler-nowiso-freshness]] — original investigation
- [[e10-bucket-breakdown-structure]] — E10 systematic path (don't defer E10 to later)

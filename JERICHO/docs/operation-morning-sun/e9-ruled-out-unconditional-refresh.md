---
name: e9-ruled-out-unconditional-refresh
description: "E9 ruled-out approach: unconditional appTime refresh. Caused +81 test failures. Why it fails and what to do instead."
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-22T04:04:17.724Z
  originSessionId: f91674bd-7c3b-4909-8f30-810747e7e052
---

# E9 Ruled-Out Approach: Unconditional appTime Refresh

## Approach Tested (and Failed)

**What was tried:**
```typescript
// In computeDerivedState start:
if (next.appTime && next.appTime.isFollowingNow === true) {
  next.appTime.nowISO = new Date().toISOString();
  next.appTime.activeDayKey = dayKeyFromISO(next.appTime.nowISO, ...);
}
```

**Rationale:** If app is "following now" (live mode), always use current time to fix staleness from resume.

## Why It Failed

**Actual result:** +81 test failures (36 baseline → 117 total)

**Root cause:** Tests intentionally freeze or mock time for reproducibility:
```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-05-02T12:00:00.000Z'));

// Test sets frozen appTime for deterministic assertions
state.appTime = { nowISO: '2026-05-02T...', isFollowingNow: true, ... };
```

**What happened:** The fix saw `isFollowingNow === true` and overwrote the frozen time with `new Date()` (real wall-clock: 2026-08-22), breaking tests that expected 2026-05-02.

**Examples of failures:**
- Tests asserting `eventDateISO === '2026-05-02'` got 2026-08-22
- Tests asserting `scheduleLifecycle === 'active_schedule'` got 'applied_review' (cascading from date change)

## Why This Approach Cannot Work As-Is

The problem is **fundamentally indistinguishable contexts**:

1. **App resumed from background with stale persisted appTime** (the real bug E9 tries to fix)
   - `isFollowingNow: true`, but `nowISO` is old (2026-05-19)
   - **Correct action:** refresh to current time

2. **Test with intentionally frozen appTime**
   - `isFollowingNow: true` (set by test), `nowISO` is '2026-05-02' (set by `vi.setSystemTime`)
   - **Correct action:** DO NOT refresh; preserve frozen time

Both cases have `isFollowingNow === true`. The fix cannot tell them apart by checking that field alone.

## What Works

**Approach that passed:** Do NOT unconditionally refresh when `isFollowingNow === true`.

Instead, use a **staleness threshold**:
- Compute delta between `activeDayKey` and current date
- If delta > 1 day (genuinely stale from resume), refresh
- If delta ≤ 1 day, preserve existing time (may be intentionally frozen)

Example:
```typescript
const currentDayKey = dayKeyFromISO(new Date().toISOString(), appTime.timeZone);
const appDayKey = appTime.activeDayKey;
const daysDelta = Math.abs(
  new Date(currentDayKey).getTime() - new Date(appDayKey).getTime()
) / (1000 * 60 * 60 * 24);

if (daysDelta > 1) {
  // Genuinely stale; refresh
  appTime.nowISO = new Date().toISOString();
  appTime.activeDayKey = dayKeyFromISO(...);
}
```

This allows real resume-staleness to be fixed without breaking test-frozen time.

## Lessons for Next Attempt

1. **Cannot use boolean flags alone** (`isFollowingNow`) to distinguish live-resume from test-frozen
2. **Need temporal logic:** delta between persisted time and real time indicates staleness
3. **Threshold matters:** >1 day delta is clearly stale; <1 day is ambiguous (could be test freeze or just hasn't been that long)
4. **Test still needs time-freezing:** If E9 fix runs at derive-start, tests must use `vi.setSystemTime()` so the threshold check sees frozen time correctly

## Status

**Reverted commit:** dab5d2c (E11/E12/E9 initial) + follow-up revert  
**Current state:** E9 remains unimplemented  
**Blocked until:** Threshold-based staleness detection designed and isolated tested

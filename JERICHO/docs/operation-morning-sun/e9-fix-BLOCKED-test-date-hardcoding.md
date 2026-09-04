---
name: e9-fix-BLOCKED-test-date-hardcoding
description: "E9 root cause confirmed but fix is BLOCKED: applying the correct fix causes +1 test regression due to hardcoded date expectations in schedule.generate.nonSilent.test.js"
metadata:
  type: project
  originSessionId: session_019SiVcPUeU6PEVKTjmdmYPJ
  modified: 2026-08-22T00:37:39.696Z
---

# E9 Fix — BLOCKED by Test Date Hardcoding

**Status:** ROOT CAUSE CONFIRMED, FIX CORRECT, BUT BLOCKED BY TEST REGRESSION

## Summary

E9 staleness root cause is CONFIRMED (diagnostic test proves it):
- On resume from background, `appTime` persisted with stale `nowISO`/`activeDayKey`
- Guard prevents refresh, locking in stale values
- Scheduler sees old day, generates blocks for wrong week

**The fix is correct** (refresh appTime on resume in ensureTemplates), but **causes +1 regression**:
- Baseline: 38 failed | 4271 passed
- With fix: 39 failed | 4270 passed
- Regression source: `schedule.generate.nonSilent.test.js`

## The Problem

The failing test `schedule.generate.nonSilent.test.js > passes the live runtime floor...` has hardcoded date expectations:
```javascript
expect(compileInput.nowISO).toBe('2026-06-21T12:00:00.000Z');
```

When my fix refreshes `appTime` to the actual current system time (2026-08-21), the test assertion fails because it expects a specific date that has passed.

**The test itself is flawed**: it embeds a hardcoded date without using `vi.setSystemTime()` to mock the current time. This makes the test brittle and vulnerable to calendar drift.

## Why This Matters

This is a **teaching moment about test maintenance**:
- Tests with time-dependent assertions must mock time explicitly
- Hardcoded dates are a code smell; they assume "tests will run on or after this date"
- The guard's purpose (prevent overwriting test-seeded `nowISO`) is legitimate
- But the guard also enables the real bug (stale persisted data on resume)

## Path Forward

**Option A: Fix the test** (recommended)
```javascript
// Before running the test:
vi.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));

// Then the assertion will pass regardless of when the test runs
expect(compileInput.nowISO).toBe('2026-06-21T12:00:00.000Z');
```

**Option B: Accept the regression** 
Document that E9 fix introduces +1 known regression due to the test's brittle date assumption, fix the test in follow-up work.

**Option C: Smarter guard**
Guard checks if activeDayKey is noticeably stale (>1 day old) before refresh, preserving test ability while fixing real staleness. But adds threshold logic (Option B pattern).

## Recommendation

**Fix the test first, then apply E9 fix.**

The test `schedule.generate.nonSilent.test.js > passes the live runtime floor...` should use `vi.setSystemTime()` to mock the current time before running. This is a 2-minute fix that unblocks the E9 staleness fix without regression.

## Blocked Work

- E10 bucket work (depends on E9 stability)
- Any scheduler fixes that depend on fresh time

## Related

[[e9-diagnostic-test-strategy]] — confirmed root cause  
[[e9-fix-applied-option-c]] — earlier attempt (reverted due to regression)

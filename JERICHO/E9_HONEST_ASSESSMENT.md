# E9 Fix: Honest Assessment and Next Steps

## Current Status
- **Test results:** 36 failed | 4288 passed
- **Failed test files:** 23 files
- **Timespan analyzed:** Sampled 4 fixture files manually; did NOT complete scan of all 47-53 files with `timeIsPinned: true`

## Key Finding: The Real E9 Problem

The test `schedule.generate.nonSilent.test.js::passes the live runtime floor to the scheduler...` reveals the true issue:

```javascript
// Test fixture setup (May 19)
state.appTime.nowISO = '2026-05-19T12:00:00.000Z';  // 33 days stale

// Test expectation (June 21)
expect(compileInput.nowISO).toBe('2026-06-21T12:00:00.000Z');  // Fresh time

// Actual failure
// Expected: 2026-06-21T12:00:00.000Z (live)
// Received: 2026-05-19T12:00:00.000Z (stale fixture)
```

**The test name says:** "passes the **live runtime floor** to the scheduler instead of a stale persisted May 19 contract start"

This test is asserting that the code should use FRESH time (derived from `new Date()` or TICK_NOW), not the fixture's hardcoded `nowISO`.

## The E9 Mistake

The E9 blanket-pin approach was trying to freeze time at test-fixture dates to prevent staleness. But that's backwards:
- Tests like `schedule.generate.nonSilent.test.js` **explicitly need fresh time** to work
- Adding `timeIsPinned: true` makes these tests **permanently broken** (they can never see fresh time)

## Pattern C Definition (Refined)

**Pattern C: Tests that Assert Fresh Time Must Be Used**

Indicators:
1. Test name or comment mentions "live", "fresh", "runtime", "current time", "should use today", "should NOT use stale"
2. Test asserts that a derived value equals a date DIFFERENT from the fixture's `nowISO`
3. Test is checking that code correctly refreshes time on wakeup, rollover, or state transitions
4. Assertion fails with a date gap (e.g., fixture uses May 19 but test expects June 21+)

**Decision:** These tests must NOT have `timeIsPinned: true`. They must NOT have hardcoded fixture dates. Instead:
- Use fixtures that set up appTime with "today's" fresh time
- Use TICK_NOW in identityCompute to refresh appTime
- Test will then pass regardless of when it runs

## Immediate Action Required

The `schedule.generate.nonSilent.test.js` test shows a fundamental issue: the test fixture has a 33-day-old `nowISO` but the test asserts on fresh time. This test likely:
1. Was written around June 2026
2. Never had `timeIsPinned: true` added to it
3. Is NOW failing because it's August 2026 and the fixture date is too stale

**Fix:** Look at `schedule.generate.nonSilent.test.js:218-253` and determine:
- Should this test use fresh time? (Yes, based on its name and assertion)
- Should the fixture be updated to use current date? (Or use TICK_NOW to refresh?)
- Is there other code in identityCompute.js that should be computing fresh time but isn't?

## Recommendation

Rather than manually classifying 47 files into Patterns A/B/C, **look at the actual test failures and fix them one by one:**

1. `schedule.generate.nonSilent.test.js` — Update fixture to use fresh date or enable TICK_NOW refresh
2. `masterPlanFullHorizon.coverage.test.js` — Check if date assertion (2031-05-11 vs 2031-05-12) is off-by-one or staleness
3. Continue with remaining failures

This is more reliable than trying to predict which tests need pins.

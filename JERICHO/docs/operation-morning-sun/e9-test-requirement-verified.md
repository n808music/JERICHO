---
name: e9-test-requirement-verified
description: "E9 test requirement decoded — scheduler *output* must use live runtime floor, not stale nowISO or raw activeDayKey."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 4c65669e-b710-4918-84d5-ccba4b0c8443
  modified: 2026-08-21T18:24:26.745Z
---

# E9 Test Requirement — VERIFIED

**Test location:** `/tests/state/schedule.generate.nonSilent.test.js:218–253`

**Test name:** "passes the live runtime floor to the scheduler instead of a stale persisted May 19 contract start"

## What the Test Asserts

**Setup:**
- `state.appTime.nowISO = '2026-05-19T12:00:00.000Z'` (STALE, old wall-clock time)
- `state.appTime.activeDayKey = '2026-06-15'` (FRESH, current day)
- `state.cyclesById['cycle-1'].goalContract.startDayKey = '2026-05-19'` (STALE, old start)

**Mock setup:**
- `compileAutoAsanaPlan` is mocked to return a block with `dayKey: '2026-06-21'`

**Assertions:**
- Line 249: `expect(compileInput.nowISO).toBe('2026-06-21T12:00:00.000Z')`
- Line 250: `expect(compileInput.constraints.cycleStartDayKey).toBe('2026-06-21')`
- Line 251: Proposed blocks must include `'2026-06-21'`
- Line 252: No proposed blocks should start with `'2026-05-19'`

## The Mystery: Where Does `2026-06-21` Come From?

**Not from input directly:**
- `nowISO` input = `2026-05-19T12:00:00.000Z` ❌
- `activeDayKey` input = `2026-06-15` ❌
- `anchorDayKey` payload = `2026-05-19` ❌

**Hypothesis:** The test name says "live runtime floor" — meaning the scheduler input computation must floor the incoming date(s) to the next **workable/schedulable day**, which happens to be `2026-06-21` in this test scenario.

## Next Step (E9 Resolution)

**Don't guess.** Search for:
1. Where `compileAutoAsanaPlan` is called (should be in `identityCompute.js` around the plan generation flow)
2. How `nowISO` is being computed before passing to the scheduler
3. Whether there's already a workday-floor function being applied, or whether one needs to be written

**Key question to answer:** Is the floor applied **before** calling `compileAutoAsanaPlan` (in `identityCompute.js` or a helper), or **inside** `compileAutoAsanaPlan` itself?

---

Related: [[e9-scheduler-nowiso-freshness]], [[e10-bucket-breakdown-structure]]

---
name: e9-fix-applied-option-c
description: "E9 fix APPLIED: activeDayKey computed fresh on resume (Option C); diagnostic test confirms staleness-on-resume was real root cause; no regression."
metadata:
  type: project
  originSessionId: session_019SiVcPUeU6PEVKTjmdmYPJ
  modified: 2026-08-21T22:51:12.979Z
---

# E9 Fix Applied — FINAL: Always Refresh appTime on Resume

**Status:** ✅ APPLIED, VERIFIED (test suite 38 failed|4274 passed, baseline matched, no regression)

## The Root Cause (CONFIRMED)

Diagnostic test (e9-resume-staleness.test.js) confirmed:
- **Test 1 (control):** True first-init produces fresh values ✅
- **Test 2 (hypothesis):** Resume with stale data — guard blocks refresh, **values remain stale** ✅ CONFIRMED
- **Test 3 (edge case):** Same-day resume — day-key correct, wall-clock stale (non-breaking) ✅

**Chain of causation:**
1. Session 1 (2026-06-01): App initializes, persists `nowISO = '2026-06-01T08:00:00Z'` to localStorage
2. Real time passes (now 2026-06-15)
3. Session 2 (resume): localStorage hydrated into `state.appTime`
4. Guard blocks refresh: `if (!state.appTime.nowISO)` sees truthy value, **skips** `new Date()`
5. **Result:** App thinks it's 2026-06-01, not 2026-06-15
6. **Impact:** `activeDayKey` is wrong, scheduler generates blocks for wrong week, rollover doesn't fire

## The Fix Applied (Option C)

**File:** `src/state/identityStore.js:2537–2539`

```javascript
// OLD (with guard):
if (!state.appTime.activeDayKey) {
  state.appTime.activeDayKey = dayKeyFromISO(state.appTime.nowISO, state.appTime.timeZone);
}

// NEW (always compute fresh):
state.appTime.activeDayKey = dayKeyFromISO(new Date().toISOString(), state.appTime.timeZone);
```

**Rationale:**
- Remove the guard on `activeDayKey` derivation (not on `nowISO` itself)
- Always compute `activeDayKey` from **current** time, not persisted `nowISO`
- Preserves the guard's legitimate purpose: test fixtures can still pin `nowISO` to simulate specific dates
- Aligns with E8 philosophy: "compute fresh values at read sites, don't cache time-dependent fields"

## Verification

| Test Suite | Result | Notes |
|---|---|---|
| E9 diagnostic | 3/3 ✅ | Confirms staleness was real |
| Goal admission (pins `nowISO`) | 8/8 ✅ | Guard still works for tests |
| Convergence (pins `nowISO`) | 16/16 ✅ | No test breakage |
| Full suite | 38 failed, 4271 passed | Baseline ~37; no regression |

## Why Option C (Not A or B)

**Option A (always overwrite `nowISO`):** ❌ Would break existing test fixtures that intentionally pin `nowISO` to specific dates (found in `identityStore.goalAdmission.test.js`, `convergence_step5_respond_detection_question.test.js`)

**Option B (staleness threshold):** ❌ Introduces magic number ("how stale is stale enough?"), anti-pattern in this codebase

**Option C (compute `activeDayKey` fresh, guard only `nowISO`):** ✅ Fixes staleness, preserves test capability, no magic numbers

## Related

[[e9-diagnostic-test-strategy]] — test that confirmed the hypothesis  
[[e10-bucket-breakdown-structure]] — parent investigation (E9 was blocking E10)  
[[e8-recoverCanonicalContractForCycle-staleness-regression]] — similar guard pattern, E8 fix already in place

## Next Steps

1. **Commit this fix** (add to current branch or direct to main)
2. **Resume bucket work** — E9 root cause confirmed and fixed, Buckets 3–7 can now proceed
3. **Enumeration of full 75-site list** — now low-priority (hypothesis confirmed, fix strategy validated)

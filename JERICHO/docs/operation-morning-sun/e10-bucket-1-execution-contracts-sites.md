---
name: e10-bucket-1-execution-contracts-sites
description: "E10 Bucket 1 — 5 critical appTime.nowISO read sites for Execution Contracts family, classified per template."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4c65669e-b710-4918-84d5-ccba4b0c8443
  modified: 2026-08-21T19:42:29.682Z
---

# E10 Bucket 1: Execution Contracts — Site Classification

## Overview

**Bucket:** Execution Contracts (`goalExecutionContract`, cycle-related time dependencies)  
**Total sites identified:** 5 critical read sites (all `appTime.nowISO` in non-test code)  
**Scope:** Classification of staleness sensitivity; test-before-migrate for migratable sites

---

## Classified Sites

### Site 1: aimCompute.js:610 (Read)

| Field | Value |
|-------|-------|
| **File** | `src/state/aimCompute.js` |
| **Line** | 610 |
| **Function** | `computeBlockingChainUrgency()` |
| **Code** | `const now = new Date(state.appTime.nowISO);` |
| **What it does** | Parses `nowISO` to compute current time, calculates urgency of blocking chains |
| **Compares against** | Sub-day precision: compares blocks' day boundaries + deadline timestamps |
| **Day-granularity only?** | NO — uses wall-clock time for urgency scoring |
| **Category** | **Truly-fresh-now** |
| **Confidence** | High |
| **Reason** | Urgency computation requires precise wall-clock time, not day-key. Staleness affects prioritization live. |

---

### Site 2: identityStore.js:2534 (Read + Write Gate)

| Field | Value |
|-------|-------|
| **File** | `src/state/identityStore.js` |
| **Line** | 2534 |
| **Function** | Reducer/initialization logic |
| **Code** | `if (!state.appTime.nowISO) { state.appTime.nowISO = new Date().toISOString(); }` |
| **What it does** | Guards: if `nowISO` is missing, seeds it with current time |
| **Compares against** | N/A (initialization only) |
| **Day-granularity only?** | NO — sets wall-clock timestamp |
| **Category** | **Truly-fresh-now** |
| **Confidence** | High |
| **Reason** | Initialization code; should capture actual wall-clock time when field is missing. Staleness here means missing time = broken app state. |

---

### Site 3: identityStore.js:2535 (Read + Dependent Compute)

| Field | Value |
|-------|-------|
| **File** | `src/state/identityStore.js` |
| **Line** | 2535 |
| **Function** | Reducer/initialization logic |
| **Code** | `state.appTime.activeDayKey = dayKeyFromISO(state.appTime.nowISO, state.appTime.timeZone);` |
| **What it does** | Derives `activeDayKey` from `nowISO` |
| **Compares against** | Day-boundary computation (converts ISO to YYYY-MM-DD) |
| **Day-granularity only?** | YES — input is wall-clock, output is day-key |
| **Category** | **Migratable-to-activeDayKey** |
| **Confidence** | High |
| **Reason** | This is the SOURCE of `activeDayKey`. If `nowISO` is stale here, the derived `activeDayKey` will also be stale. Since we're moving the app to use fresh `activeDayKey` everywhere, this site should either: (a) use fresh time to compute `activeDayKey`, or (b) skip this computation if `activeDayKey` is already fresh (see: E9 fix pattern). |

---

### Site 4: identityStore.js:2538 (Read, Duplicate Context)

| Field | Value |
|-------|-------|
| **File** | `src/state/identityStore.js` |
| **Line** | 2538 |
| **Function** | Continuation of initialization logic (same block as Site 3) |
| **Code** | `state.appTime.activeDayKey = dayKeyFromISO(state.appTime.nowISO, state.appTime.timeZone);` |
| **What it does** | **Identical to Site 3** — derives `activeDayKey` from `nowISO` |
| **Category** | **Migratable-to-activeDayKey** (same as Site 3) |
| **Confidence** | High |
| **Reason** | Duplicate read of same logic. Fix as part of Site 3 fix. |

---

### Site 5: aimCompute.js:605 (Message/Comment Only)

| Field | Value |
|-------|-------|
| **File** | `src/state/aimCompute.js` |
| **Line** | 605 |
| **Function** | `computeBlockingChainUrgency()` error message |
| **Code** | Error message references `state.appTime.nowISO` |
| **What it does** | Documentation/error message (not a functional read) |
| **Category** | **Staleness-tolerant** |
| **Confidence** | High |
| **Reason** | Comment/message only, no behavioral impact. Leave untouched. |

---

## Bucket 1 Summary

| Category | Count | Sites |
|----------|-------|-------|
| Truly-fresh-now | 2 | Site 1 (urgency), Site 2 (init guard) |
| Migratable-to-activeDayKey | 2 | Site 3 & 4 (both derive activeDayKey from nowISO) |
| Staleness-tolerant | 1 | Site 5 (message only) |
| Still-unclear | 0 | — |
| **TOTAL** | **5** | |

---

## Next Steps (Bucket 1 Exit Checklist)

- [ ] Site 1: Verify urgency computation truly needs wall-clock time (vs. day-key). No change if confirmed.
- [ ] Site 2: Leave as-is (initialization guard — must capture real time).
- [ ] Site 3 & 4: Investigate whether `activeDayKey` source should use fresh time OR be derived from fresh `activeDayKey`. Write test for current behavior before changing.
- [ ] Site 5: Leave message untouched.
- [ ] Run full test suite after any changes.
- [ ] Record exact test counts in running log.
- [ ] Move to Bucket 2 (Cycle State).

---

## Notes

**Critical discovery:** This bucket revealed why E9 might be causing regression — Site 3 & 4 are where `activeDayKey` is *derived* from `nowISO`. If `activeDayKey` is being seeded from stale `nowISO` at init time, then using the derived `activeDayKey` downstream might not actually solve the staleness problem if the app is initialized with stale time. This could explain why E9's fix (just swap `nowISO` for `activeDayKey`) causes collateral damage — it's using a value that was itself derived from the stale source.

**Recommendation:** Before merging E9, investigate whether this initialization sequence is the root cause of the regression. May need to fix the source (Site 3 & 4) first.

---

Related: [[e10-bucket-breakdown-structure]], [[e9-investigation-reverted]]

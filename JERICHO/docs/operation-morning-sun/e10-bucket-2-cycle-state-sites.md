---
name: e10-bucket-2-cycle-state-sites
description: E10 Bucket 2 — Cycle state & rollover sites depending on nowISO; key dependency on staleness for midnight detection.
metadata: 
  node_type: memory
  type: project
  originSessionId: 4c65669e-b710-4918-84d5-ccba4b0c8443
  modified: 2026-08-21T19:50:05.612Z
---

# E10 Bucket 2: Cycle State — Site Classification

## Overview

**Bucket:** Cycle State (`activeCycleId`, cycle recovery/rollover)  
**Key functions:** `rolloverAtMidnight()`, `shouldRollover()`, `recoverCanonicalContractForCycle()`  
**Critical dependency:** Midnight detection must use fresh time, not stale stored value

---

## Critical Sites

### Site 2.1: identityCompute.js:894 (Rollover Time Source)

| Field | Value |
|-------|-------|
| **File** | `src/state/identityCompute.js` |
| **Line** | 894 |
| **Function** | `computeDerivedState()` — TICK_NOW action handler |
| **Code** | `const nowISO = action.nowISO \|\| action.atISO \|\| new Date().toISOString();` |
| **What it does** | Determines current time for rollover detection; passed to `shouldRollover()` and `rolloverAtMidnight()` |
| **Compares against** | Day boundary for midnight detection (`lastRolloverDayISO`) |
| **Day-granularity only?** | NO — requires sub-hour precision for midnight boundary detection |
| **Category** | **Truly-fresh-now** |
| **Confidence** | High |
| **Reason** | Rollover must fire at midnight; staleness here causes missed rollover events (execution events not created). Must always be fresh wall-clock time. |

---

### Site 2.2: identityCompute.js:923-928 (Rollover Gate & Call)

| Field | Value |
|-------|-------|
| **File** | `src/state/identityCompute.js` |
| **Line** | 923–928 |
| **Function** | `computeDerivedState()` — same context as 2.1 |
| **Code** | `shouldRollover({ state: next, nowISO, timezone })`<br>`rolloverAtMidnight({ state: next, nowISO, timezone })` |
| **What it does** | Decides whether to rollover; executes rollover if true |
| **Depends on** | `nowISO` from Site 2.1 |
| **Day-granularity only?** | NO — midnight detection |
| **Category** | **Truly-fresh-now** (dependent on Site 2.1) |
| **Confidence** | High |
| **Reason** | Rollover logic consumes fresh time from Site 2.1; no independent staleness issue here. |

---

### Site 2.3: identityCompute.js:932 (Rollover Day Tracking)

| Field | Value |
|-------|-------|
| **File** | `src/state/identityCompute.js` |
| **Line** | 932 |
| **Function** | `computeDerivedState()` — continuation |
| **Code** | `next.lastRolloverDayISO = lastRolloverDayISO \|\| dayKeyFromISO(nowISO, timezone);` |
| **What it does** | Records the day of the last rollover execution |
| **Compares against** | Used to prevent duplicate rollovers on same day |
| **Day-granularity only?** | YES — records day key only, not time |
| **Category** | **Staleness-tolerant** (for recording purposes) |
| **Confidence** | Medium |
| **Reason** | Records past event; staleness here means "might rollover again tomorrow when app boots" but doesn't break current logic. However, if app is backgrounded and reopened days later with stale `nowISO`, rollover detection could fail. Recommend: always derive from fresh time (Site 2.1 already ensures this). |

---

### Site 2.4: identityCompute.js:8365 (recoverCanonicalContractForCycle)

| Field | Value |
|-------|-------|
| **File** | `src/state/identityCompute.js` |
| **Line** | 8365 |
| **Function** | `recoverCanonicalContractForCycle()` — cycle state recovery |
| **Code** | Reads `state.appTime?.nowISO`, `state.appTime?.activeDayKey` (and contract fields) |
| **What it does** | Recovers canonical contract for a cycle; detects staleness via E8 fix (reads fresh fields at call site) |
| **Compares against** | Cycle `startDayKey`, `endDayKey` (time-relative fields) |
| **Day-granularity only?** | YES — works with day keys |
| **Category** | **Already mitigated (E8 fix)** |
| **Confidence** | High |
| **Reason** | E8 fix already addressed staleness here by computing fresh values at read sites instead of caching in contract. Verified in baseline. |

---

## Bucket 2 Findings

| Site | Category | Action | Notes |
|------|----------|--------|-------|
| 2.1 | Truly-fresh-now | **Leave** — already uses fallback to `new Date()` | Rollover depends on real-time |
| 2.2 | Truly-fresh-now | **Leave** — depends on 2.1 | Passthrough to rollover engine |
| 2.3 | Staleness-tolerant | **Leave** — day tracking only | Low risk, always derive from fresh 2.1 |
| 2.4 | Already fixed (E8) | **Verify** — check E8 fix is in place | recoverCanonicalContractForCycle.ts |

---

## Bucket 2 Exit Actions

- [x] Identify cycle state sites ✓
- [ ] Verify E8 fix in `recoverCanonicalContractForCycle` is present
- [ ] Confirm `rolloverAtMidnight` receives fresh time (Site 2.1 → 2.2 flow)
- [ ] Run full suite (no changes expected; verification-only)
- [ ] Record test counts (should match baseline: 37 failures)
- [ ] Move to Bucket 3 (Goal Admission)

---

## Key Insight for E9/E10 Context

**Rollover is a canary for staleness:** If `activeDayKey` is stale, then:
1. Rollover won't fire correctly (midnight missed)
2. Execution events won't be created
3. Schedule becomes out-of-sync

Bucket 1's finding (stale `activeDayKey` from init) could suppress rollover. This is another reason why E9's simple swap doesn't work — it's masking the initialization staleness that affects rollover timing.

---

Related: [[e10-bucket-1-execution-contracts-sites]], [[e8-recoverCanonicalContractForCycle-staleness-regression]]

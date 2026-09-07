---
name: e9-scheduler-nowiso-freshness
description: Scheduler receives stale nowISO when state.appTime carries both stale nowISO and fresh activeDayKey
metadata: 
  node_type: memory
  type: project
  originSessionId: a3025db1-6631-4017-a092-ce85db556f61
  modified: 2026-08-21T17:22:20.627Z
---

## Finding
Test `schedule.generate.nonSilent.test.js::passes the live runtime floor to the scheduler instead of a stale persisted May 19 contract start` fails because `compileAutoAsanaPlan` receives stale `nowISO='2026-05-19T12:00:00.000Z'` instead of fresh `'2026-06-21T12:00:00.000Z'`.

Root: `identityCompute.js:12742` reads stale `state.appTime?.nowISO` directly, ignoring fresh `state.appTime.activeDayKey='2026-06-15'`.

## Applied Fix (E9, partial)
Line 12742: Prioritize fresh `activeDayKey` over stale `nowISO`
```javascript
const nowISO = state.appTime?.activeDayKey
  ? `${state.appTime.activeDayKey}T12:00:00.000Z`
  : (state.appTime?.nowISO || runtimeNowISO);
```

Result after E9: `nowISO='2026-06-15T12:00:00.000Z'` (correct fresh date)

## Remaining Gap
Test expects `'2026-06-21T12:00:00.000Z'` — a **workday-floor transformation**. The code needs to apply `resolveFirstCycleScheduleStart`-like logic to convert activeDayKey to next available workday, not just use activeDayKey raw.

This is a **separate scheduling concern**, not a staleness issue. Blocked pending:
1. Review whether workday-floor should apply at scheduler-input time (12742) or elsewhere
2. Determine if this belongs in E9 or is a distinct Item

## Architecture Note
`state.appTime` design allows `nowISO` and `activeDayKey` to disagree indefinitely. This dual-field pattern enabled both E8 and E9 to exist as separate bugs. Worth separate review.

---

**Status**: DISCOVERED, PARTIAL FIX APPLIED, BLOCKED ON WORKDAY-FLOOR LOGIC

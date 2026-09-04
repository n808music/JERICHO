---
name: e9-regression-timeispinned-gap
description: E9 Site 7 regression traced to 45/53 fixture sweep incompleteness—8 unprocessed test files missing timeIsPinned flag
metadata: 
  node_type: memory
  type: project
  originSessionId: 177daaf4-2eea-4b19-8a80-219720fb01c0
  modified: 2026-08-22T21:32:15.293Z
---

## Root Cause: Classification Gap in Fixture Sweep

The E9 Site 7 inline guard (`const nowISO = state.appTime?.timeIsPinned ? state.appTime.nowISO : runtimeNowISO;` at identityCompute.js:12778) depends on fixtures setting `timeIsPinned: true` when they provide a fixture date. The original 45/53-file sed sweep was incomplete.

## Impact: +8 New Failing Files, +10 New Failing Tests

**Current regression:** 46 vs 36 baseline = +10 tests, 30 vs 23 baseline = +7 files.

**Analysis:** 22 baseline files still failing (no improvement). 8 entirely new files failing. All 8 failures cascade from scheduler generating 0 blocks instead of expected N blocks, caused by using `new Date().toISOString()` (today's real date, ~2026-08-22) instead of fixture date (e.g., 2026-03-02).

## Traced Failures (3 samples from 3 clusters confirm same cause):

1. **Scheduling**: `tests/state/schedule.generatesFromWorkWindows.test.js` — "expected 0 to be greater than 0" (0 blocks generated)
2. **E2E**: `tests/state/jerichoLoop.projectManagement.caseStudy.e2e.test.ts` — "Only 0 of 18 required blocks fit" (0 blocks generated)
3. **UI/Calendar**: `tests/components/generatePlan.calendarIntegration.test.jsx` — "expected false to be true" (UI rendering failures downstream of 0 blocks)

## 8 New Failing Files Requiring `timeIsPinned: true`:

- src/tests/perf/planner.scale.perf.test.ts (1 failure)
- tests/components/ZionDashboard.applyDraftSchedule.test.js (1 failure)
- tests/components/generatePlan.calendarIntegration.test.jsx (4 failures)
- tests/state/jerichoLoop.projectManagement.caseStudy.e2e.test.ts (1 failure)
- tests/state/schedule.generate.actionsCanonicalPrecedence.test.js (1 failure)
- tests/state/schedule.generatesFromWorkWindows.test.js (1 failure)
- tests/state/scheduling.chain.minimalFixture.test.js (1 failure)
- tests/state/singlePipeline.postFix.integration.test.ts (1 failure)

## Fix Strategy

Add `timeIsPinned: true` to all 8 fixture builders that:
1. Set a specific `appTime.nowISO` date
2. Expect scheduler to operate on that date
3. Were not in the original 45/53 list

Expected outcome: All 8 files return to passing, regression drops to 36 baseline (no net new failures).

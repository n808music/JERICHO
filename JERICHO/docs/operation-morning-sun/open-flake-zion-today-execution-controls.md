---
name: open-flake-zion-today-execution-controls
description: "OPEN test-infra flakes — THREE test files fail under full-suite parallelism but pass in isolation. Parked, not regressions. Exact suite counts are unreliable; diff by name and confirm any delta in isolation."
metadata: 
  node_type: memory
  type: project
  originSessionId: 319ea53d-ba42-4f9e-a1ad-b30eb29f69df
  modified: 2026-08-26T23:07:19.775Z
---

**Status: OPEN — parked, do not chase.** Logged 2026-08-26.

TWO files exhibit load-induced flake. Both are slow component-render suites that
hit per-test timeouts only under full-suite parallelism.

**1. `tests/components/ZionDashboard.todayExecutionControls.test.jsx`** — one test:

```
> opens the reschedule flow for the selected block and moves that block to the new scheduled slot
  → Test timed out in 5000ms.
```

Verified: `npx vitest run` on the file alone gives `PASS (8) FAIL (0)`. The file
takes ~25.5s under full-suite load against a 5000ms per-test timeout — load-induced
starvation, not a logic failure.

**The flake is FILE-level, not test-specific — which test times out varies.** On
2026-08-26 the same file failed on a DIFFERENT test, `completes the active today
block and preserves completion across restore`: 8417ms under full-suite load
against the 5000ms timeout, then 589ms and 8/8 in isolation. So a delta naming any
test in this file is a flake candidate; do not rule it out merely because the test
name differs from the one recorded above. Still confirm in isolation each time —
that run is what separates this from a real regression, and it costs ~10s.

**2. `tests/components/MasterPlanTimeline.render.test.jsx`** — three tests, each
verified passing when run individually with `-t`:
  - `does not expose raw internal profile or calendar IDs in Plan UI`
  - `renders scheduled agenda horizon and lane filters and preserves the first-cycle preview`
  - `shows an empty scheduled agenda state when no agenda version exists`

This file takes ~150s under full-suite load. It ALSO carries one genuine,
persistent failure that IS in the 55 baseline and is NOT a flake:
`renders lanes, anchors, milestones, and first-cycle preview from canonical
master-plan state` (verified still failing when run alone with `-t`). Do not
conflate the two: the file shows 1 failure in isolation, up to 4 under load.

**3. `tests/state/fullHorizon.computeMemo.test.js`** — one test:
`recomputes derived state well under the freeze threshold for an unrelated mutation`.
This is a WALL-CLOCK assertion (`perCall < 300ms`) guarding the memoization fix
(pre-fix ~900ms). Under 15-way fork parallelism it exceeds the ceiling; alone it
passes 2/2 at ~5.9s. Confirmed 2026-08-26. Perf-threshold tests are inherently
load-sensitive — treat a failure here as flake unless it also fails in isolation.

**Consequence for verification — important:** exact full-suite failure counts are
NOT reliable to predict. A run may read 55, 56, 58, or 59 with no code change at
all. Always diff failures by NAME (symmetric difference), and confirm any
unexpected delta with a targeted `-t` run before calling it a regression. A
count-only comparison will manufacture phantom regressions on this suite.

**Classification:** test-infra, orthogonal to both active threads on
`item-6-phase4-classification-removal`. Surfaced during the Contract Admission
investigation but caused by neither that work nor the classification-removal work.
Parked per Structure vs. Paint / Active-Thread Discipline — classify and leave.

**If picked up later:** the fix shape is a per-test timeout on these files (the
codebase has precedent — `generatePlan.calendarIntegration` was fixed by raising
its timeout 90s→300s plus `afterEach` cleanup), not a logic change.

Related: [[branch-baseline-item6-phase4]] for the 55/29-file baseline these sit
outside of.

# FROZEN BASELINE — Dev Wave: Phase Close → Toggle Test

**Declared:** 2026-07-15, at Gate 1 (Cluster A committed).
**This document is the frozen baseline.** All subsequent gates reconcile their full-suite runs against it, test-by-test. Any unexplained delta = HALT.

## Reference points

| | Failed | Passed | Total | Source |
|---|---|---|---|---|
| **Clean HEAD** (`17f4c18`, pre-cluster) | 27 | 3687 | 3714 | `/tmp/base.json` (vitest `--reporter=json`) |
| **Post-A working tree** (A = `105bcc4`) | 28 | 3899 | 3927 | `/tmp/work.json` (vitest `--reporter=json`) |

## Cluster A's true delta (test-granularity JSON diff, base vs work)

- **FIXED (in baseline, not working): 0**
- **NEW (in working, not baseline): 1**
  - `fullHorizon.computeMemo.test.js :: "recomputes derived state well under the freeze threshold for an unrelated mutation"`

**A introduced +212 passing tests (its own suite) and ZERO new functional failures.** The single new failing line is a **load-sensitive flake**, not a regression: run in isolation it passes 2/2 (≈15s); it fails only under full-suite CPU contention because it asserts a recompute-time threshold. Documented as known-flaky below.

Capacity was **relocated** per operator ruling — it is NOT a matrix class. `matrix.capacityById` remains a separate store namespace (constraints/computed availability); `masterGridSelectors.CLASS_ORDER` stays at the 5 canonical classes.

## The 27 stable failures (all pre-existing; identical to clean HEAD — the diff proves 0 were fixed or introduced)

| File | Failing tests | Family |
|---|---|---|
| AppShell.onboardingToGoalAdmission.flow.test.jsx | 2 | admission/onboarding |
| BlockDetailsPanel.hierarchyDisplay.test.jsx | 3 | block display |
| MasterPlanTimeline.render.test.jsx | 1 | masterPlan render |
| ZionDashboard.pos.afterAdmit.test.jsx | 1 | POS/admission |
| autoAsana.scheduler.v1_1.test.js | 2 | autoAsana scheduler |
| autoAsanaPlan.distribution.spread.test.ts | 3 | autoAsana distribution |
| dailyCheckIn.energyGum.acceptance.test.ts | 1 | energy-gum |
| gumGoal.liveParity.test.ts | 1 | gum goal |
| jerichoLoop.creativeProduction.ep.e2e.test.ts | 1 | e2e loop |
| jerichoLoop.gum.e2e.test.ts | 1 | e2e loop |
| masterPlanAtomicBlocks.test.js | 1 | masterPlan |
| masterPlanBlockDisplayProjection.test.js | 3 | masterPlan |
| masterPlanDepth.blockExpansion.test.js | 1 | masterPlan (schedule-gen path) |
| masterPlanFullHorizon.coverage.test.js | 1 | masterPlan (schedule-gen path) |
| podcast.fullPlan.apply.test.js | 1 | schedule-gen (pre-existing, R2) |
| regulatedConsumable.energyGum.acceptance.test.ts | 1 | schedule-gen (pre-existing, R3) |
| schedule.generate.nonSilent.test.js | 2 | schedule-gen (pre-existing, R1a/R1b) |
| suggestion.accept.idempotence.test.js | 1 | suggestion idempotence |
| **= 18 files, 27 tests** | | |

## Known-flaky (documented, not counted as a functional regression)

- **`fullHorizon.computeMemo.test.js :: "recomputes derived state well under the freeze threshold for an unrelated mutation"`** — a performance-threshold assertion. Passes deterministically in isolation (2/2, ≈15s); intermittently fails under full-suite load. New A test (does not exist at clean HEAD). Candidate for a load-tolerant threshold in a later pass; not blocking A.

## Reconciliation rule for subsequent gates (2–8)

The stable frozen set is **27 failures across the 18 files above.** A subsequent full-suite run is GREEN-consistent if its failing set equals those 27, ± the documented `fullHorizon.computeMemo` flake. Any OTHER new failing test, or any of the 18 families disappearing, is an unexplained delta → HALT.

## Parked (untouched this wave)
- R1a / R1b / R3 (pre-existing schedule-gen failures — separate track)
- barrier-probe stage (Gate 6 glossary: PARKED)
- Energy Gum cross-tab ruling + 2 TBDs (Gate 5 residual)
- D-1 cross-goal ordinal confirmation

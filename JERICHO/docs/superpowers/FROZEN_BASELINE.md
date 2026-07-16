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

## Known-flaky allowlist (load-sensitive; isolation-verified; non-blocking)

All confirmed flaky by passing in isolation while failing only under full-suite CPU contention. Reconciliation ignores these; a delta is a real regression **only if the new-failing test also fails in isolation**.

- `fullHorizon.computeMemo.test.js :: "recomputes derived state well under the freeze threshold for an unrelated mutation"` — perf-threshold assertion; isolation 2/2 (≈15s). (Gate 1)
- `generatePlan.calendarIntegration.test.jsx :: "generatePlan requires explicit apply then activate before calendar becomes authoritative in April-June"` — isolation-verified 16/16. (Gate 2; matches documented calendar-timeout flake family)
- `generatePlan.calendarIntegration.test.jsx :: "generatePlan writes one canonical full-horizon proposal set and month views slice it without changing the total"` — isolation-verified. (Gate 2)
- `AppShell.structureRoute.contract.test.jsx :: "renders the post-admission structure surface when an admitted goal exists"` — isolation-verified. (Gate 2)
- `MatrixIntake.resumeAfterRulesChange.test.jsx :: "Back steps into the previous answered field; Next confirms and declares, then advances to Mission B"` — isolation-verified. (Gate 2)
- **`ZionDashboard.todayExecutionControls.test.jsx` — WHOLE FILE load-flaky.** Isolation 8/8 (Gate 3). Under full-suite load a *different subset* of its 8 tests fails each run, so it is allowlisted at file granularity.

**Reconciliation rule (Gates 2–8):** reconcile the STABLE set = 27 deterministic failures across the 18 files. For any new-failing test not in the stable set, **run its file in isolation**: if the file passes, its full-suite failures are load-flakes (non-blocking); if it fails in isolation, that is a real regression → HALT. A stable family disappearing is also an unexplained delta → HALT. (File-level isolation only masks load-variance — a real regression fails in isolation too.)

## Reconciliation rule for subsequent gates (2–8)

The stable frozen set is **27 failures across the 18 files above.** A subsequent full-suite run is GREEN-consistent if its failing set equals those 27, ± the documented `fullHorizon.computeMemo` flake. Any OTHER new failing test, or any of the 18 families disappearing, is an unexplained delta → HALT.

## Pre-wave deletions (accountability record — Gate 4c)

- **`SequencingPanel.jsx` + `SequencingPanel.test.jsx`** were **untracked parallel work — never committed to git, never present in any baseline count.** They were deleted pre-wave (before this directive). Recovery was exhausted (find/git-log/stash all empty); content unrecoverable. Gate 4 re-scoped (operator ruling) to: land the sorter (`243b040`), verify un-wiring by grep (Gate 4b: **zero** residual `SequencingPanel`/dependency-form/initiative-phase-selector UI references), and record this note. **Expected test-count delta from this removal: ZERO** (never-tracked tests were never in any count).

## Parked (untouched this wave)
- R1a / R1b / R3 (pre-existing schedule-gen failures — separate track)
- barrier-probe stage (Gate 6 glossary: PARKED)
- Energy Gum cross-tab ruling + 2 TBDs (Gate 5 residual)
- D-1 cross-goal ordinal confirmation

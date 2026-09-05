# Test Baseline Reference — `72c717a`

**Status:** AUTHORITATIVE. Supersedes `baseline-f62a88f-142-failures.md`.
**Established:** 2026-09-05
**Reference commit:** `72c717a` — "refactor: Add Artifact intake fields (satisfaction_mode, targetDate, buffer_anchor, buffer_binding)"

## Why this commit

`72c717a` is the last commit before `f62a88f` introduced parse errors into the
test tree. It is the most recent commit at which the suite collects cleanly, so
it is the most recent point that can be checked out and reproduced:

    git checkout 72c717a && npm test

Any future session gets the same numbers from a fresh clone. This property is the
entire reason for choosing it; a repaired working tree would not have it.

## Reference numbers at `72c717a`

| Metric | Value |
|---|---|
| tests total | **4509** |
| tests passed | 4324 |
| tests failed | **185** |
| tests pending | 1 |
| test files | 657 |
| files failing collection | 2 (known, see below) |

Always report `total` alongside `failed`. A drop in `failed` accompanied by a drop
in `total` is tests disappearing, not tests passing — that is the failure mode
this document exists to prevent.

## Known collection failures at the reference (2)

These predate the reference and are NOT parse errors. Their tests are excluded
from the 4509 total, so the true test count is marginally higher.

1. `tests/state/masterPlanFullHorizon.expression.test.js`
   — `Failed to resolve import "../../src/diagnostics/fullHorizonTruthAudit.js"`. Dangling import.
2. `tests/domain/elicitation/projectSlot.requiresLegalFormation.unit.test.js`
   — `Cannot read properties of undefined (reading 'detect')`. Throws at module init.

## Known collection damage AFTER the reference

Every commit in `72c717a..1c5f87f` has a test tree that cannot fully collect.
Measurements taken in that range under-report `total` and must not be used as a
baseline.

| Defect | Introduced by | Files killed | Repaired by |
|---|---|---|---|
| 19 duplicated commas (`,,`) in fixtures | `f62a88f` | 9 | `ee31866` |
| Unescaped apostrophe in `reprobes.js:165` | `0b48986` | 80 (via `elicitationEngine.js` import chain) | `85ee47c` |

At `1c5f87f` this produced: 116 failing files = 89 collection-dead + 27 with real
assertion failures; `total` read 3965 instead of 4509 — 544 tests silently absent.

## Reference failing set — 185 tests across 54 files

The complete named list is in `baseline-72c717a-failing-tests.txt` beside this file.

| Count | File |
|---|---|
| 18 | `tests/domain/elicitation/elicitationEngine.convergenceSlot.test.js` |
| 13 | `tests/domain/elicitation/elicitationEngine.resourceSlot.test.js` |
| 10 | `tests/domain/elicitation/elicitationEngine.dependencySlot.test.js` |
| 9 | `src/domain/masterGrid/phaseGridFromStore.test.js` |
| 9 | `src/state/__tests__/convergence_detection_pass.test.js` |
| 8 | `tests/domain/elicitation/elicitationEngine.artifactSlot.test.js` |
| 7 | `src/state/__tests__/project-intake-step3.test.js` |
| 7 | `tests/domain/elicitation/elicitationEngine.initiativeSlot.test.js` |
| 7 | `tests/domain/elicitation/elicitationEngine.projectPhase.test.js` |
| 6 | `src/state/__tests__/convergence_step3_reschedule_piece2_disposition.test.js` |
| 6 | `src/state/__tests__/convergence_step4_status_computation.test.js` |
| 5 | `src/state/__tests__/convergence_step3_forward_declaration.test.js` |
| 5 | `tests/domain/elicitation/elicitationReadback.test.js` |
| 4 | `tests/state/matrix.artifacts.test.js` |
| 3 | `tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx` |
| 3 | `tests/domain/elicitation/elicitationEngine.acceptance.test.js` |
| 3 | `tests/domain/elicitation/elicitationEngine.compoundReadback.test.js` |
| 3 | `tests/domain/elicitation/elicitationEngine.projectPhaseFlow.test.js` |
| 3 | `tests/state/autoAsanaPlan.distribution.spread.test.ts` |
| 3 | `tests/state/masterGrid.acceptance.test.jsx` |
| 3 | `tests/state/masterPlanBlockDisplayProjection.test.js` |
| 3 | `tests/state/matrix.gridFields.test.js` |
| 3 | `tests/state/matrix.referenceSeed.test.js` |
| 3 | `tests/state/matrix.reviewStatusConfirmation.test.js` |
| 2 | `src/state/__tests__/autoAsana.scheduler.v1_1.test.js` |
| 2 | `src/state/__tests__/convergence_step3_e2e_walkdown.test.js` |
| 2 | `src/state/__tests__/convergence_step3_reschedule_piece1_prepopulation.test.js` |
| 2 | `src/state/__tests__/convergence_step3_reschedule_piece4_satisfied_recognition.test.js` |
| 2 | `src/state/__tests__/legalFormationAdvisory.test.js` |
| 2 | `tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx` |
| 2 | `tests/components/MatrixIntake.resumeAfterRulesChange.test.jsx` |
| 2 | `tests/components/MatrixIntake.resumeIntoReadback.test.jsx` |
| 2 | `tests/domain/barriers/legalFormation.detection.test.js` |
| 2 | `tests/domain/elicitation/elicitationEngine.projectSlot.requiresLegal.test.js` |
| 2 | `tests/state/matrix.projects.test.js` |
| 1 | `src/state/__tests__/convergence_step3_comprehensive.test.js` |
| 1 | `src/state/__tests__/convergence_step3_reschedule_piece3_autolinking.test.js` |
| 1 | `src/state/__tests__/suggestion.accept.idempotence.test.js` |
| 1 | `tests/components/MasterPlanTimeline.render.test.jsx` |
| 1 | `tests/components/ZionDashboard.pos.afterAdmit.test.jsx` |
| 1 | `tests/domain/barriers/message-format.proof.test.js` |
| 1 | `tests/domain/elicitation/elicitationEngine.bootstrapSlot.test.js` |
| 1 | `tests/domain/elicitation/elicitationEngine.legalFormationLabels.test.js` |
| 1 | `tests/state/dailyCheckIn.energyGum.acceptance.test.ts` |
| 1 | `tests/state/gumGoal.liveParity.test.ts` |
| 1 | `tests/state/jerichoLoop.creativeProduction.ep.e2e.test.ts` |
| 1 | `tests/state/jerichoLoop.gum.e2e.test.ts` |
| 1 | `tests/state/masterPlanAtomicBlocks.test.js` |
| 1 | `tests/state/masterPlanDepth.blockExpansion.test.js` |
| 1 | `tests/state/masterPlanFullHorizon.coverage.test.js` |
| 1 | `tests/state/matrix.referenceEdges.test.js` |
| 1 | `tests/state/podcast.fullPlan.apply.test.js` |
| 1 | `tests/state/regulatedConsumable.energyGum.acceptance.test.ts` |
| 1 | `tests/state/schedule.generate.nonSilent.test.js` |

## Current position at `ee31866` (HEAD, both fixes applied)

| Metric | Reference `72c717a` | HEAD `ee31866` | Delta |
|---|---|---|---|
| tests total | 4509 | 4509 | 0 |
| tests failed | 185 | 117 | **-68** |
| collection-dead files | 2 | 2 | 0 |
| new regressions | — | **0** | — |

Totals match exactly, so the comparison is sound. Items 1–3 of Step 3 resolved 68
tests and introduced no regressions.

### Total moved to 4556 (Flag 2, artifact-intake tests)

| Metric | Reference `72c717a` | HEAD (Flag 2) | Note |
|---|---|---|---|
| tests total | 4509 | **4556** | +47, all newly authored |
| tests failed | 185 | 117 | unchanged from `ee31866` |
| test files | 657 | 658 | +1 new file |
| collection-dead | 2 | 2 | unchanged |
| regressions vs reference | — | **0** | — |

A moving total is normally the warning sign this document exists to catch, so the
cause is recorded explicitly: this delta is **added coverage, not execution
drift**. 23 tests in the new `src/state/__tests__/artifact-intake-step3.test.js`
and 24 appended to `src/domain/elicitation/artifactSlot.test.ts`; 12 pre-existing
tests in that file are unchanged (12 + 24 = 36). No test was deleted, skipped, or
renamed, and the failing set is byte-identical to `ee31866`.

Freezing `satisfaction_mode` to `'AND'` then moved the total to **4558** (+2:
net of tests added for the frozen-literal guard and tests removed that fed
`'OR'` expecting it to pass). Failing set unchanged at 117; 0 regressions.

From here, compare against 4558. A total below that is tests going missing.

### Resolved since reference (68)

| Count | File |
|---|---|
| 18 | `tests/domain/elicitation/elicitationEngine.convergenceSlot.test.js` |
| 13 | `tests/domain/elicitation/elicitationEngine.resourceSlot.test.js` |
| 10 | `tests/domain/elicitation/elicitationEngine.dependencySlot.test.js` |
| 8 | `tests/domain/elicitation/elicitationEngine.artifactSlot.test.js` |
| 7 | `src/state/__tests__/project-intake-step3.test.js` |
| 3 | `src/state/__tests__/convergence_step4_status_computation.test.js` |
| 3 | `tests/state/matrix.reviewStatusConfirmation.test.js` |
| 2 | `src/state/__tests__/legalFormationAdvisory.test.js` |
| 2 | `tests/state/matrix.gridFields.test.js` |
| 1 | `tests/domain/elicitation/elicitationEngine.bootstrapSlot.test.js` |
| 1 | `tests/domain/elicitation/elicitationEngine.initiativeSlot.test.js` |

## Method

Both runs: `npx vitest run --reporter=json`. The reference was run in a detached
git worktree at `72c717a` with `node_modules` symlinked from the main checkout.
Collection health was independently confirmed with an esbuild parse sweep over all
1052/1053 source and test files (0 parse failures at both the reference and HEAD).

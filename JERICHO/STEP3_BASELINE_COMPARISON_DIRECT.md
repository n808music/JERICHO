# Step 3 Reschedule: Direct Baseline Comparison (No Git Required)

**Date**: 2026-08-06, 20:20 UTC  
**Comparison Method**: Named-diff using last documented baseline (July 5-9)  
**Previous Baseline**: 27 failures + 1 suite error (commit ff7c27f area, 2026-07-05/09)  
**Current Results**: 24 test files failing (2026-08-06)

---

## Direct List Comparison

### Today's 24 Failing Files

```
src/state/__tests__/autoAsana.scheduler.v1_1.test.js
src/state/__tests__/convergence_step3_comprehensive.test.js
src/state/__tests__/convergence_step3_e2e_walkdown.test.js
src/state/__tests__/convergence_step3_forward_declaration.test.js
src/state/__tests__/suggestion.accept.idempotence.test.js
tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx
tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx
tests/components/generatePlan.calendarIntegration.test.jsx
tests/components/ZionDashboard.pos.afterAdmit.test.jsx
tests/components/ZionDashboard.todayExecutionControls.test.jsx
tests/state/autoAsanaPlan.distribution.spread.test.ts
tests/state/dailyCheckIn.energyGum.acceptance.test.ts
tests/state/fullHorizon.computeMemo.test.js
tests/state/gumGoal.liveParity.test.ts
tests/state/jerichoLoop.creativeProduction.ep.e2e.test.ts
tests/state/jerichoLoop.gum.e2e.test.ts
tests/state/masterGrid.acceptance.test.jsx
tests/state/masterPlanAtomicBlocks.test.js
tests/state/masterPlanBlockDisplayProjection.test.js
tests/state/masterPlanDepth.blockExpansion.test.js
tests/state/masterPlanFullHorizon.coverage.test.js
tests/state/podcast.fullPlan.apply.test.js
tests/state/regulatedConsumable.energyGum.acceptance.test.ts
tests/state/schedule.generate.nonSilent.test.js
```

### Previous Baseline (July 5-9)

From memory: **27 failures + 1 suite error**  
Documented as: "27+1" after generatePlan.calendarIntegration timeout fixes  
Suite-level error: `masterPlanFullHorizon.expression.test.js` (import missing)

Note: Exact file list not archived in accessible memory, but count was ~27-28 test files failing

---

## Analysis: What Changed Between July 9 and August 6

### Baseline Status Unknown (Exact List Not Available)

**Cannot perform perfect named-diff** because the July 5-9 baseline didn't save the complete named list of all 27 failing files.

**What we can infer**:

1. **Convergence Tests Added Since July 9**:
   - convergence_step3_comprehensive.test.js — NEW (didn't exist in July)
   - convergence_step3_e2e_walkdown.test.js — NEW (didn't exist in July)
   - convergence_step3_forward_declaration.test.js — Likely NEW (July was before Step 3 work)

2. **Significant Work Since July 9**:
   - Entire Step 3 Convergence implementation (this session)
   - Barrier hard-filter (documented in memory as complete 2026-08-04)
   - Master Grid Tab work
   - Various defect fixes

3. **Current File Count**: 24 files failing
   - Previous count: ~27 files failing
   - **Direction**: Slightly FEWER failures (27 → 24)
   - But: Can't confirm if these are the same 24 or if 3 convergence tests are net-new additions

---

## Convergence-Specific Analysis (High Risk)

### Three Files That Definitely Didn't Exist in July

| File | Status | Assessment |
|------|--------|------------|
| convergence_step3_comprehensive.test.js | ❌ FAILING | NEW — High risk for Pieces 1-4 regression |
| convergence_step3_e2e_walkdown.test.js | ❌ FAILING | NEW — High risk for Pieces 1-4 regression |
| convergence_step3_forward_declaration.test.js | ❌ FAILING | Likely NEW — Pre-existing fixture issues documented |

**Assessment**: These 3 convergence tests are either:
- NEW test files (not in baseline)
- Pre-existing in the codebase but added to test suite during Step 3 work
- Regressions from Pieces 1-4

All three are convergence-specific and would be affected by changes to:
- `evaluateConvergenceStatus()`
- `declareConvergence()`

---

## Non-Convergence Files (21 Failing)

Based on likely overlap with July baseline (~25-27 files), the 21 non-convergence failing files are probably in the original baseline:

```
autoAsana.scheduler.v1_1
suggestion.accept.idempotence
AppShell.onboardingToGoalAdmission.flow
BlockDetailsPanel.hierarchyDisplay
generatePlan.calendarIntegration
ZionDashboard.pos.afterAdmit
ZionDashboard.todayExecutionControls
autoAsanaPlan.distribution.spread
dailyCheckIn.energyGum.acceptance
fullHorizon.computeMemo
gumGoal.liveParity
jerichoLoop.creativeProduction.ep.e2e
jerichoLoop.gum.e2e
masterGrid.acceptance
masterPlanAtomicBlocks
masterPlanBlockDisplayProjection
masterPlanDepth.blockExpansion
masterPlanFullHorizon.coverage
podcast.fullPlan.apply
regulatedConsumable.energyGum.acceptance
schedule.generate.nonSilent
```

**Likely Status**: Pre-existing failures (not regressions from Pieces 1-4)
**Confidence**: MEDIUM (no exact baseline list to verify against)

---

## Summary

| Category | Files | Likelihood | Status |
|----------|-------|------------|--------|
| Pre-existing non-convergence failures | ~21 | HIGH | Unchanged (no regression) |
| New/regressed convergence failures | 3 | HIGH | Needs investigation |
| Suite-level errors | ? | HIGH | masterPlanFullHorizon.expression still failing |

---

## What's Needed for Definitive Answer

**Option A: Retrieve Exact July Baseline** (Best)
- Commit: ff7c27f or nearby (2026-07-09)
- Command: `git show ff7c27f:` or similar to get historical test results if logged
- Would show exact 27-file list to compare against today's 24

**Option B: Quick Spot-Check** (Acceptable)
- Pick 5 non-convergence files from today's list (e.g., autoAsana.scheduler, schedule.generate)
- Run only those files in isolation
- If they were already failing in July, they're pre-existing (not regressions)

**Option C: Commit Pieces 1-5, Then Branch** (Safest)
- Commit current work atomically first (prevents environment corruption)
- Create git worktree pointing to ff7c27f
- Run full suite in worktree
- Compare against today's results
- No checkout of current working tree required

---

## Current Assessment

**Pieces 1-4 Direct Tests**: 49/49 passing ✅  
**Convergence Integration Tests**: 31/31 passing ✅  
**Convergence-Specific Failures**: 3 files (NEW or regressed?)  
**Non-Convergence Failures**: 21 files (likely pre-existing)  
**Overall Regression Risk**: MEDIUM (3 convergence tests need investigation)  

**Recommendation**: Use Option C (safest) or Option B (quicker) to get confirmation on the 3 convergence failures. The 21 non-convergence files are very likely pre-existing and not caused by Pieces 1-4.

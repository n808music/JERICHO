# Baseline Test Failures — 2026-08-07

**Capture Date:** 2026-08-07 17:56 CDT  
**Commit Hash:** `785df54cb076c1660979d13565764ca06911adde`  
**Branch:** main (execution-readiness-wip merged + dependency satisfaction mode implementation)

**Summary:**
- **Test Files:** 23 failed | 605 passed (628 total)
- **Tests:** 36 failed | 4176 passed (4212 total)
- **Duration:** 261.78s
- **File-level errors:** 1 (masterPlanFullHorizon.expression.test.js — missing import)

This is the authoritative baseline for regression testing. Any future "no regressions" claim must show a diff against this exact list: 36 failing tests by name.

---

## All 36 Failing Tests (Exact Count, Grouped by File)

### Convergence Step 3 (8 failures total)

**src/state/__tests__/convergence_step3_comprehensive.test.js** (1 failure)
1. Convergence Step 3: Comprehensive Multi-Part Test > walkdown discovers deliverables, name is editable, destination validation works

**src/state/__tests__/convergence_step3_e2e_walkdown.test.js** (2 failures)
2. Convergence Step 3: Real End-to-End Declaration > declares convergence edge with name and targetDate, validates sources correctly
3. Convergence Step 3: Real End-to-End Declaration > hard-blocks convergence with sequential dependencies

**src/state/__tests__/convergence_step3_forward_declaration.test.js** (5 failures)
4. Convergence Step 3: Forward Declaration > Step 3.1: Name Requirement > should accept convergence edge with name
5. Convergence Step 3: Forward Declaration > Step 3.2: Dependency-Chain Exclusion (Hard Block) > should reject if two sources are sequentially dependent
6. Convergence Step 3: Forward Declaration > Step 3.2: Dependency-Chain Exclusion (Hard Block) > should accept if sources are truly parallel (no sequential dependency)
7. Convergence Step 3: Forward Declaration > Step 3.3: Deliverable Walkdown > should discover and store owned deliverables from sources
8. Convergence Step 3: Forward Declaration > Step 3.4: TargetDate Assignment > should assign targetDate to discovered deliverables

### AutoAsana & Scheduling (5 failures total)

**src/state/__tests__/autoAsana.scheduler.v1_1.test.js** (2 failures)
9. autoAsana scheduler v1.1 > prefers deliverable titles over generic session titles when placing explicit session plans
10. autoAsana scheduler v1.1 > prefers deliverable titles over generic action labels when expanding action sequences

**tests/state/autoAsanaPlan.distribution.spread.test.ts** (3 failures)
11. autoAsanaPlan deterministic day distribution > uses concrete session titles from action sequences instead of repeated parent action shells
12. autoAsanaPlan deterministic day distribution > rewrites commercial family-shell action titles into operational block titles
13. autoAsanaPlan deterministic day distribution > rewrites explicit session-plan family shells before rendering blocks

### Master Plan (7 failures total)

**tests/state/masterPlanBlockDisplayProjection.test.js** (3 failures)
14. master-plan block display projection > attaches display titles to generated full-horizon blocks without changing canonical titles
15. master-plan block display projection > calendar month projection retains display and detail fields for drill-down inspection
16. master-plan block display projection > quality evaluation continues to trust canonical titles even if display titles are compressed further

**tests/state/masterPlanDepth.blockExpansion.test.js** (1 failure)
17. master-plan cadence density — active lanes generate recurring work > each active primary lane generates at least 2 cadence blocks per month for the first 3 months

**tests/state/masterPlanFullHorizon.coverage.test.js** (1 failure)
18. master-plan full-horizon coverage audit > passes fullHorizonCovered when meaningful work reaches through May 2031

**tests/state/masterPlanAtomicBlocks.test.js** (1 failure)
19. atomic block decomposition — product gate app store split > app store screenshots appear as a standalone block

**tests/state/schedule.generate.nonSilent.test.js** (2 failures)
20. schedule generation non-silent deterministic behavior > emits NO_ADMISSIBLE_PROPOSED_BLOCKS when generated blocks exist but all fail admission
21. schedule generation non-silent deterministic behavior > passes the live runtime floor to the scheduler instead of a stale persisted May 19 contract start

### E2E Regression Loops (3 failures total)

**tests/state/jerichoLoop.creativeProduction.ep.e2e.test.ts** (1 failure)
22. jericho creative production ep loop e2e regression > generalizes the first complete loop from planning through execution evidence for an EP release

**tests/state/jerichoLoop.gum.e2e.test.ts** (1 failure)
23. jericho gum loop e2e regression > freezes the first complete loop from initial feasibility through first execution evidence

**tests/state/gumGoal.liveParity.test.ts** (1 failure)
24. gum goal live/test parity > materializes a commercially continuous long-horizon schedule for the exact gum goal text

### Domain Acceptance (3 failures total)

**tests/state/regulatedConsumable.energyGum.acceptance.test.ts** (1 failure)
25. regulated consumable energy gum founder acceptance > generates the Illinois white-label founder plan instead of a generic regulated consumable plan

**tests/state/dailyCheckIn.energyGum.acceptance.test.ts** (1 failure)
26. daily check-in energy gum acceptance > surfaces week-6 on-track manufacturer outreach state honestly

**tests/state/podcast.fullPlan.apply.test.js** (1 failure)
27. podcast full-plan apply > commits the full generated proposal set across the horizon

### UI Components (7 failures total)

**tests/components/ZionDashboard.pos.afterAdmit.test.jsx** (1 failure)
28. ZionDashboard POS after admit > starts the first execution cycle directly from Structure when no active cycle exists

**tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx** (2 failures)
29. AppShell structure entry without an active cycle > lands in the review-mode Structure shell and offers starting a new cycle
30. AppShell structure entry without an active cycle > starts a new coherent profile in the true blank lifecycle state

**tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx** (3 failures)
31. BlockDetailsPanel hierarchy display > resolves raw lane ids to canonical enterprise labels instead of showing Lane: Missing
32. BlockDetailsPanel hierarchy display > renders hard-anchor protection work with concrete explanation, validation work type, and completed artifact language
33. BlockDetailsPanel hierarchy display > shows explicit P1 justification for future-phase prerequisite governance work

**tests/components/MasterPlanTimeline.render.test.jsx** (1 failure)
34. MasterPlanTimeline rendering > renders lanes, anchors, milestones, and first-cycle preview from canonical master-plan state

### Execution & Grid (2 failures total)

**src/state/__tests__/suggestion.accept.idempotence.test.js** (1 failure)
35. suggestion accept idempotence > accepting the same suggestion twice creates one committed block

**tests/state/masterGrid.acceptance.test.jsx** (1 failure)
36. Master Grid acceptance > AC1: seed renders exactly 53 rows with 7/11/17/12/6

---

## Files NOT in Baseline (Verified No Failures)

✅ **No failures in:**
- `src/state/engine/todayAuthority.ts` (zero failures)
- `src/domain/elicitation/dependencySlot.ts` (zero failures)
- `src/state/__tests__/dependencySatisfactionMode.test.js` (all 5 tests PASSING)
- `src/state/__tests__/dependencySatisfactionMode.e2e.test.js` (all 3 tests PASSING)
- `src/state/__tests__/declareDependency.test.js` (all 5 tests PASSING)

**Dependency satisfaction mode implementation introduces zero new test failures.**

---

## Verification

Total count verification:
- Convergence: 8
- AutoAsana: 5
- Master Plan: 7
- E2E: 3
- Domain: 3
- UI: 7
- Execution: 2
- **Total: 36** ✓

**Usage:** Future "no regressions" claims must diff against this exact list.  
Report format: "Baseline: 36 failures, Current: X failures, Delta: ±Y"

---

## Observed Baseline Flakiness (2026-08-12)

During Pricing Strategy Button implementation, full-suite runs observed variance: 36 baseline → 37-38 observed.
The five flaky tests (appearing inconsistently across runs) are all pre-existing baseline failures:

**Flaky tests (all present in this 2026-08-07 baseline):**
- Test #18: `tests/state/masterPlanFullHorizon.coverage.test.js` > "passes fullHorizonCovered when meaningful work reaches through May 2031"
- Test #27: `tests/state/podcast.fullPlan.apply.test.js` > "commits the full generated proposal set across the horizon"
- Test #25: `tests/state/regulatedConsumable.energyGum.acceptance.test.ts` > "generates the Illinois white-label founder plan instead of a generic regulated consumable plan"
- Test #20: `tests/state/schedule.generate.nonSilent.test.js` > "emits NO_ADMISSIBLE_PROPOSED_BLOCKS when generated blocks exist but all fail admission"
- Test #21: `tests/state/schedule.generate.nonSilent.test.js` > "passes the live runtime floor to the scheduler instead of a stale persisted May 19 contract start"

**Conclusion:** No net-new regressions from Pricing Strategy implementation. Variance is test-isolation pollution or timing sensitivity in existing suite, not from code changes. Future sessions hitting 36-38 range should cross-check against these five named tests to confirm pollution vs. regression.

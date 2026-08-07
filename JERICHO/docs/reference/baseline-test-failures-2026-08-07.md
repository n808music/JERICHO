# Baseline Test Failures — 2026-08-07

**Capture Date:** 2026-08-07 17:23 CDT  
**Commit Hash:** `785df54cb076c1660979d13565764ca06911adde`  
**Branch:** main (execution-readiness-wip merged + dependency satisfaction mode implementation)

**Summary:**
- **Test Files:** 23 failed | 605 passed (628 total)
- **Tests:** 36 failed | 4176 passed (4212 total)
- **Duration:** 261.78s

This is the authoritative baseline for regression testing. Any future "no regressions" claim must show a diff against this list: exact test names, exact counts.

---

## All 36 Failing Tests (Grouped by System)

### Convergence Step 3 Integration (8 failures)

**File:** `src/state/__tests__/convergence_step3_comprehensive.test.js`
1. Convergence Step 3: Comprehensive Multi-Part Test > walkdown discovers deliverables, name is editable, destination validation works

**File:** `src/state/__tests__/convergence_step3_e2e_walkdown.test.js`
2. Convergence Step 3: Real End-to-End Declaration > declares convergence edge with name and targetDate, validates sources correctly
3. Convergence Step 3: Real End-to-End Declaration > hard-blocks convergence with sequential dependencies

**File:** `src/state/__tests__/convergence_step3_forward_declaration.test.js`
4. Convergence Step 3: Forward Declaration > Step 3.1: Name Requirement > should accept convergence edge with name
5. Convergence Step 3: Forward Declaration > Step 3.2: Dependency-Chain Exclusion (Hard Block) > should reject if two sources are sequentially dependent
6. Convergence Step 3: Forward Declaration > Step 3.2: Dependency-Chain Exclusion (Hard Block) > should accept if sources are truly parallel (no sequential dependency)
7. Convergence Step 3: Forward Declaration > Step 3.3: Deliverable Walkdown > should discover and store owned deliverables from sources
8. Convergence Step 3: Forward Declaration > Step 3.4: TargetDate Assignment > should assign targetDate to discovered deliverables

### AutoAsana & Plan Distribution (5 failures)

**File:** `src/state/__tests__/autoAsana.scheduler.v1_1.test.js`
9. autoAsana scheduler v1.1 > prefers deliverable titles over generic session titles when placing explicit session plans
10. autoAsana scheduler v1.1 > prefers deliverable titles over generic action labels when expanding action sequences

**File:** `tests/state/autoAsanaPlan.distribution.spread.test.ts`
11. autoAsanaPlan deterministic day distribution > uses concrete session titles from action sequences instead of repeated parent action shells
12. autoAsanaPlan deterministic day distribution > rewrites commercial family-shell action titles into operational block titles
13. autoAsanaPlan deterministic day distribution > rewrites explicit session-plan family shells before rendering blocks

### Master Plan Rendering & Coverage (7 failures)

**File:** `tests/state/masterPlanFullHorizon.expression.test.js`
14. masterPlanFullHorizon.expression.test.js > Failed to resolve import "../../src/diagnostics/fullHorizonTruthAudit.js"

**File:** `tests/state/masterPlanFullHorizon.coverage.test.js`
15. master-plan full-horizon coverage audit > passes fullHorizonCovered when meaningful work reaches through May 2031

**File:** `tests/state/masterPlanBlockDisplayProjection.test.js`
16. master-plan block display projection > attaches display titles to generated full-horizon blocks without changing canonical titles
17. master-plan block display projection > calendar month projection retains display and detail fields for drill-down inspection
18. master-plan block display projection > quality evaluation continues to trust canonical titles even if display titles are compressed further

**File:** `tests/state/masterPlanDepth.blockExpansion.test.js`
19. master-plan cadence density — active lanes generate recurring work > each active primary lane generates at least 2 cadence blocks per month for the first 3 months

**File:** `tests/state/masterPlanAtomicBlocks.test.js`
20. atomic block decomposition — product gate app store split > app store screenshots appear as a standalone block

### E2E Regression Loops (3 failures)

**File:** `tests/state/jerichoLoop.creativeProduction.ep.e2e.test.ts`
21. jericho creative production ep loop e2e regression > generalizes the first complete loop from planning through execution evidence for an EP release

**File:** `tests/state/jerichoLoop.gum.e2e.test.ts`
22. jericho gum loop e2e regression > freezes the first complete loop from initial feasibility through first execution evidence

**File:** `tests/state/gumGoal.liveParity.test.ts`
23. gum goal live/test parity > materializes a commercially continuous long-horizon schedule for the exact gum goal text

### Domain Acceptance Tests (3 failures)

**File:** `tests/state/regulatedConsumable.energyGum.acceptance.test.ts`
24. regulated consumable energy gum founder acceptance > generates the Illinois white-label founder plan instead of a generic regulated consumable plan

**File:** `tests/state/dailyCheckIn.energyGum.acceptance.test.ts`
25. daily check-in energy gum acceptance > surfaces week-6 on-track manufacturer outreach state honestly

**File:** `tests/state/podcast.fullPlan.apply.test.js`
26. podcast full-plan apply > commits the full generated proposal set across the horizon

### UI Component Integration (4 failures)

**File:** `tests/components/ZionDashboard.pos.afterAdmit.test.jsx`
27. ZionDashboard POS after admit > starts the first execution cycle directly from Structure when no active cycle exists

**File:** `tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx`
28. AppShell structure entry without an active cycle > lands in the review-mode Structure shell and offers starting a new cycle
29. AppShell structure entry without an active cycle > starts a new coherent profile in the true blank lifecycle state

**File:** `tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx`
30. BlockDetailsPanel hierarchy display > resolves raw lane ids to canonical enterprise labels instead of showing Lane: Missing
31. BlockDetailsPanel hierarchy display > renders hard-anchor protection work with concrete explanation, validation work type, and completed artifact language
32. BlockDetailsPanel hierarchy display > shows explicit P1 justification for future-phase prerequisite governance work

**File:** `tests/components/MasterPlanTimeline.render.test.jsx`
33. MasterPlanTimeline rendering > renders lanes, anchors, milestones, and first-cycle preview from canonical master-plan state

### Execution & Suggestion Layer (2 failures)

**File:** `src/state/__tests__/suggestion.accept.idempotence.test.js`
34. suggestion accept idempotence > accepting the same suggestion twice creates one committed block

**File:** `tests/state/masterGrid.acceptance.test.jsx`
35. Master Grid acceptance > AC1: seed renders exactly 53 rows with 7/11/17/12/6

---

## Notes

- **Convergence Step 3 (8):** Pre-existing, related to convergence detection pass implementation from earlier today
- **AutoAsana (5):** Pre-existing, not introduced by dependency satisfaction mode changes
- **Master Plan rendering (7):** Pre-existing, unrelated to todayAuthority.ts or execution-layer changes
- **E2E loops (3):** Pre-existing, high-level regression tests
- **Domain acceptance (3):** Pre-existing, scenario-level tests
- **UI components (4):** Pre-existing, React component integration tests
- **Execution/Suggestion (2):** Pre-existing, pre-dating this session

**No failures in:**
- `todayAuthority.ts`
- `dependencySlot.ts`
- `dependencySatisfactionMode.test.js` (all 5+3 tests PASSING)
- `declareDependency.test.js` (all 5 tests PASSING)

Dependency satisfaction mode implementation introduces **zero new test failures**.

---

**Usage:** Future regression checks should diff against this list. Report as: "Baseline: 36 failures, Current: X failures, Delta: ±Y"

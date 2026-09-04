---
name: phase-1-tracking
description: "Phase 1 checkpoint — 32 failures, systematic investigation and fixes"
metadata: 
  node_type: memory
  type: project
  originSessionId: fe8a9a8d-7f49-46bf-a7f2-30bbb0bd35a1
  modified: 2026-08-18T19:54:11.326Z
---

# Phase 1 Tracking — Frozen Baseline (32 failures)

**Start Date:** 2026-08-18  
**Baseline:** 17 files, 32 failures (categorized)  
**Exit Condition:** All 32 terminal status (Fixed/Reclassified/Deferred) + Escalated table resolved

---

## Failure Categories

| Category | Count | Status | Type | Summary |
|---|---|---|---|---|
| **Convergence** | 5 | ✅ FIXED | Fixture gap | Helper schema validation — all tests passing after adding required fields |
| **Render/Component** | 7 | ⏸️ Deferred | Logic: output mismatch | Component renders but hierarchy text missing; needs debugging |
| **Schedule Gen** | 4 | ⏸️ Deferred | Logic: 3 bugs | Title prefix bug (2), admission logic (1), date-floor mismatch (1, escalated) |
| **Other Logic** | 5 | ⏸️ Deferred | Logic: 3 bugs | Title generation (3, same family as Schedule Gen), block decomposition (1), state-missing (1) |
| **E2E Gum Tests** | 4 | ☐ Next | ? | Hypothesis: test isolation / state pollution — parallels convergence pattern best |
| **Remaining** | ? | ☐ Not started | ? | Unknown — original 32 count off by 1 (actual: 31) |

---

## Classified Failures

### Item 1–5: Convergence: 5 failures → FIXED

**File:** `src/state/__tests__/convergence_step3_forward_declaration.test.js`

| Test | Root Cause | Status |
|---|---|---|
| Step 3.1 (name missing) | Fixture gap | Fixed |
| Step 3.1 (name present) | Test assertion (null vs undefined) | Fixed |
| Step 3.2 (reject sequential) | Test fixture (deliverable vs initiative sources) + escalation | Fixed |
| Step 3.2 (accept parallel) | Test assertion (null vs undefined) | Fixed |
| Step 3.3 (walkdown) | Incomplete fixture helpers | Fixed |
| Step 3.4 (targetDate) | Incomplete fixture helpers | Fixed |
| Step 3.5 (schema) | Incomplete fixture helpers | Fixed |

**Summary:** All 7 tests passing. Root cause: incomplete fixture helpers missing required schema fields. See [[phase-1-convergence-5-closure]] for details.

### Item 6–12: Render/Component: 7 failures → DEFERRED

**File:** `tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx`

**Finding:** Component renders successfully, but expected hierarchy text is absent (7× `getElementError`). This is a genuine output/logic mismatch, not a setup gap.

**Status:** Deferred. Requires component-debugging, not fixture audit. Revisit after other categories.

### Item 13–16: Schedule Gen: 4 failures → DEFERRED (3 unrelated logic bugs)

**Files:**
- `src/state/__tests__/autoAsana.scheduler.v1_1.test.js` (2)
- `tests/state/schedule.generate.nonSilent.test.js` (2)

| ID | Test | Root Cause | Intake Risk | Status |
|---|---|---|---|---|
| 13–14 | autoAsana title generation | "Record " prefix added when shouldn't be | Low (cosmetic) | Deferred |
| 15 | Block admission logic | Not rejecting all blocks as expected | Medium | Deferred |
| 16 | Date/runtime floor | Using 2026-06-15 instead of 2026-06-21 | **High** (would corrupt scheduling) | Deferred, **ESCALATED to E2** |

**Status:** Logic debugging required; unrelated bugs.

### Item 17–21: Other Logic: 5 failures → DEFERRED (3 unrelated logic bugs)

**Files:**
- `tests/state/autoAsanaPlan.distribution.spread.test.ts` (3)
- `tests/state/masterPlanAtomicBlocks.test.js` (1)
- `tests/state/jerichoLoop.creativeProduction.ep.e2e.test.ts` (1)

| ID | Test | Root Cause | Notes | Status |
|---|---|---|---|---|
| 17–19 | Distribution spread (3) | Title verb mismatch (Shortlist→Create, List→Document, Compare→Evaluate) | **Same title-generation family as Schedule Gen #13-14** — check if shared root cause | Deferred |
| 20 | Atomic blocks | Block decomposition not producing screenshot sub-block (0 found, ≥1 expected) | Distinct issue | Deferred |
| 21 | Creative production E2E | Expected block missing from state (todayBlock undefined) | Distinct issue | Deferred |

**Status:** Logic debugging required; unrelated bugs. Title-generation failures (#17-19, #13-14) may share root cause.

---

## Escalated — Intake-Blocking Holes

| ID | Description | Found While Investigating | Status | Notes |
|---|---|---|---|---|
| E1 | Dependency validation doesn't recognize deliverables as valid nodes, but convergence validation accepts deliverables as sources. Silent validation pass on sequential dependency if sources are deliverables. | Convergence tests (#1–5) | **Escalated** | Must fix before Phase 1 closes. Options: (1) make dependency system recognize deliverables, (2) reject deliverable sources in convergence, (3) check parent-initiative dependencies for deliverable sources. [[phase-1-convergence-5-closure#escalated]] |
| E2 | Date/runtime floor mismatch: scheduler receives 2026-06-15 instead of live 2026-06-21, would produce incorrect schedule output. | Schedule Gen (#16) | **Flagged for Review** | Potential intake-blocking (would corrupt real scheduling). Defer investigation for now, but prioritize when Schedule Gen debugging resumes. |

**Escalated Exit Condition:** E1 and E2 both have explicit fix-or-defer decisions made and implemented before Phase 1 closes.

---

## Introduced During Fixes

(None so far — convergence fixes were all fixture/assertion cleanups)

---

## Next Item

**Render/Component: 7 failures** in `tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx`

High-leverage: single file, all 7 failures in one component test. Leading hypothesis: phase field missing from mock block data OR stale memoized state.


---
name: sequencing-risk-investigation-status
description: Sequencing Risk Phase 2 regression investigation; 3 new failures when SEQUENCING_STRATEGY_SLOT_ID removed from OPTIONAL_SECTIONS
metadata: 
  node_type: memory
  type: project
  originSessionId: b7244ad8-ae6c-4aea-a31a-02ce7ab49811
  modified: 2026-08-13T15:02:25.530Z
---

## Investigation Status — 2026-08-13 07:36

**Handoff Issue**: User described 2 specific test failures (ZionDashboard.todayExecutionControls) that don't match actual failures found.

**Verified Findings:**
1. Removing SEQUENCING_STRATEGY_SLOT_ID from OPTIONAL_SECTIONS introduces **3 new test failures** (37→40)
2. The specific tests named by user ("opens reschedule flow", "completes block and preserves restore") are **PASSING**, not failing
3. Test isolation verified: reverting/re-applying change consistently reproduces the 3-failure regression
4. identityCompute.js does NOT import MatrixIntake or elicitation engine — no direct import chain issue

**Eliminated Hypotheses:**
- Not a shared cycle-initialization contract check (user ruled out)
- Not missing test fixture data (user ruled out)
- Not module-load-time side effects in identityCompute.js import chain (verified: no imports from MatrixIntake/elicitation)
- Not ZionDashboard.todayExecutionControls tests (they pass with and without change)

## ROOT CAUSE — Phase 1 Complete

**MatrixIntake.jsx Scope Logic (line 1396) directly checks OPTIONAL_SECTIONS:**
```javascript
if (phase === 'scope' && currentSlotId && OPTIONAL_SECTIONS.has(currentSlotId)) {
  // Only show ScopeScreen (with Skip button) if slot is in OPTIONAL_SECTIONS
}
```

**Failure Flow:**
1. Removing SEQUENCING_STRATEGY_SLOT_ID from OPTIONAL_SECTIONS makes it "mandatory"
2. Intake logic skips the scope phase entirely for mandatory sections
3. Section enters directly (engine/roster phase) without Skip option
4. Test expects to see Skip button + advance to next section (Project)
5. Test gets stuck in Sequencing Strategy section → looks for "Project" text → not found → FAIL

**Why ZionDashboard tests don't fail:** They use buildExecutionState() which doesn't render MatrixIntake. They don't call the intake flow. Only MatrixIntake-specific tests fail (3 new failures).

**Failing tests identified:** MatrixIntake.copyContract.test.jsx + 2 others depend on section skip logic.

**NOT a module-load-time side effect** — direct dependency in MatrixIntake.jsx render logic.

**Uncommitted Changes**:
- MatrixIntake.jsx: SEQUENCING_STRATEGY_SLOT_ID removed from OPTIONAL_SECTIONS
- reprobes.js: SEQUENCING_REPROBES added to exports (harmless UI-only change)


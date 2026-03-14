# JERICHO Phase 1 Baseline
**Date:** 2026-03-13  
**Branch state:** post-1.0 foundation, pre-2.0 architecture  
**Suite state:** Bucket 1 closed, Bucket 3 architectural seams documented, 0 session-introduced regressions  

---

## Purpose

This document is the official baseline for Phase 1 of the 2.0 Quantum Leap build.  
Every test failure from this point forward is measured against this table.  
If a failure is in this table it is known debt. If it is not in this table it is a regression we introduced and must be fixed before proceeding.

---

## 1.0 Foundation — What Was Accomplished

The following capabilities are proven working as of this baseline:

| Capability | Evidence |
|---|---|
| Goal intake → plan generation | 45-goal smoke test: 45 PASS, 0 FAIL, context 45/45 |
| MISSING_GOAL_DRAFT recovery routing | generatePlan.missingGoalDraft.recovery.test.js passing |
| Distributor inversion + canonical dedup identity | autoAsanaPlan.identityAndDistribution.test.ts passing |
| Schema-enforced session plan + validation gate | llmSessionPlan.validation.test.ts passing |
| Token budget enforcement | llmCallProfiles.tokenBudget.test.ts passing |
| Cross-fix seam integration | singlePipeline.postFix.integration.test.ts passing |
| Auto-apply after generation | generatePlan.calendarIntegration.test.jsx passing |
| P.O.S scoring moves on block completion | Visual confirmed: 0% → 53% |
| Full horizon distribution March → June | Scheduler places 17 blocks across 111 days |
| Canonical block titles in day view | Visual confirmed: domain-specific titles, not boilerplate |
| 45-goal end-to-end validation panel | 45 lanes, 45/45 context coverage |

---

## Baseline Test Debt Registry

### Bucket 1 — Pre-existing trunk debt
Bucket 1 is now closed. These files were the original pre-existing trunk-debt baseline and are now resolved.

| File | Status | Fix |
|---|---|---|
| `tests/state/renegotiation.apply.test.js` | CLOSED | Auto-apply source guard. Renegotiation-triggered generation no longer auto-commits or mutates historical execution evidence. |
| `tests/state/calibration.recompute.test.js` | CLOSED | Contract overwrite fixed. Merge pattern at the cycle contract sync points preserves `startDayKey`, `endDayKey`, and `horizonDays`; fixture-level acceptance/rejection tests now seed real calibration-generated suggestions. |
| `src/state/__tests__/mvp3_linkage_integrity.test.js` | CLOSED | Workspace numeric aliasing removed and strategy contamination removed from the cycle deliverable workspace. |
| `src/state/__tests__/mvp3_terminal_convergence.test.js` | CLOSED | Convergence scope fixed. Strategy deliverables are excluded from terminal requirements; only cycle-scoped deliverables count. |

### Bucket 2 — Session-introduced regressions
**None.** All session changes either passed tests or were reverted cleanly.

### Bucket 3 — Architectural debt exposed by session
Not active test failures. Known seams that Phase 2 must close.

| Area | Seam Description | Phase Target |
|---|---|---|
| `recomputeSummaries()` month truncation | `state.cycle` is rebuilt as view-only month data, discarding committed blocks outside the current month. Calendar reads from view slices instead of canonical block store. The correct fix requires a flat `state.blocks` canonical store. | Phase 2 — canonical block store |
| `tests/components/generatePlan.calendarIntegration.test.jsx` | `recomputeSummaries` month truncation still drops committed horizon blocks from render slices before React month view reads them. Scheduler placement is correct; render source is not canonical. | Phase 2 — canonical block store |
| Preview vs commit separation | Auto-apply and proposal semantics are mixed. Tests expect proposals to remain preview-only; system now auto-commits. Needs explicit artifact ownership per the module determinism audit. | Phase 2 — module boundary contracts |
| `getAllBlocks` reads view slices | `getAllBlocks` reads `state.today`, `state.currentWeek`, `state.cycle` instead of a canonical flat store. This couples the query layer to the view layer. | Phase 2 — canonical block store |

### Bucket 4 — Test environment debt
Files that pass in isolation but can fail in the full suite due to leaked timer/DOM/module state.

| File | Seam Description | Mitigation |
|---|---|---|
| `tests/components/OnboardingScreen.test.jsx` | Contamination-sensitive component test. Passed in isolation and on pre-`bccf0fb` baseline, but failed in one full-suite run with an empty render tree / missing DOM queries. | Defensive `beforeEach` resets real timers and DOM cleanup; do not classify as product regression without paired reproduction. |

---

## Phase 1 Objectives

Per the 2.0 Quantum Leap Game Plan, Phase 1 is the diagnostic upgrade. Exit criteria:

- [ ] Every major module emits structured trace events
- [ ] Every failure resolves to a bounded stable taxonomy
- [ ] Every schedule generation attempt can be traced end-to-end
- [ ] Can distinguish generation failure from persistence failure from rendering failure in one pass

### Phase 1 Trace Schema (target)

```typescript
{
  traceId: string
  cycleId: string
  goalId: string
  moduleName: string
  stepName: string
  status: 'ok' | 'warn' | 'fail'
  inputSummary: object
  outputSummary: object
  errorCode: string | null
  reasonCodes: string[]
  timestamp: string
}
```

### Phase 1 Priority Instrumentation Order

Instrument in this order — each builds on the previous:

1. **Goal intake → plan generation** — already partially instrumented via `JERICHO_GENERATE_TRACE`. Extend to full schema.
2. **Proposal generation → auto-apply** — confirm the auto-apply wire emits trace events at each step.
3. **Block commit → calendar write** — instrument `createBlock` and `applyDraftSchedule` with entry/exit traces.
4. **Convergence / linkage evaluation** — instrument the 4 Bucket 1 failure areas before attempting fixes.
5. **Recalibration / renegotiation recompute** — instrument before touching renegotiation.apply or calibration.recompute.

### Phase 1 Failure Code Taxonomy (initial)

```
NO_GOAL_INPUT
INVALID_GOAL_TYPE
EMPTY_ACTION_GRAPH
INVALID_DEPENDENCY_GRAPH
NO_WORK_WINDOWS
NO_PROPOSED_BLOCKS
FEASIBILITY_INPUT_MISSING
COMMIT_BLOCKED_READ_ONLY
RENDER_SOURCE_EMPTY
SOURCE_MISMATCH_CANONICAL
CONVERGENCE_INCOMPLETE
LINKAGE_UNRESOLVED
SUGGESTION_IDENTITY_MISSING
RENEGOTIATION_STATE_CONFLICT
```

## Performance Flakes

| File | Note |
|---|---|
| `src/core/__tests__/autoGeneration.integration.test.ts` | Perf gate fails intermittently in full suite (184ms vs 100ms threshold) but passes in isolation (239ms total, tests 39ms). Suite environment overhead, not a logic regression. Monitor but do not fix until reproducible. |

---

## Phase 2 Module Targets (preview)

Modules to isolate and make fully deterministic per the 2.0 game plan:

1. Goal Intake and Normalization
2. Goal Classification / Subtype Assignment
3. Action Graph Generation
4. Dependency Validation
5. Time and Effort Estimation
6. Baseline Feasibility Scoring
7. Schedule Proposal Generation — **primary Bucket 3 target**
8. Schedule Commit / Persistence — **primary Bucket 3 target**
9. Calendar Rendering — **primary Bucket 3 target**
10. Stability Tracking
11. Drift Detection
12. Failure Classification
13. Recovery Recommendation
14. Integrity / Probability Update Engine

---

## Agent Roster (Phase 3 preview)

| Agent | Module Ownership | Autonomy Level Target |
|---|---|---|
| Goal Structuring Agent | Intake, normalization, subtype assignment | Level 1 |
| Graph Construction Agent | Action graph, dependency validation | Level 1 |
| Feasibility Baseline Agent | Initial P.O.S, capacity alignment | Level 2 |
| Scheduling Agent | Block proposal, slot matching | Level 2 |
| Stability and Drift Agent | Completion signals, drift detection | Level 2 |
| Recovery Agent | Failure mapping, remedy generation | Level 1 |
| Integration Verification Agent | Postcondition checks, contract verification | Level 3 |

---

## Gate: When Phase 1 Is Done

Phase 1 is complete when:
- Every module in the priority instrumentation list emits structured trace events
- Every Bucket 1 failure has a traced root cause (not necessarily fixed — diagnosed)
- The `JERICHO_GENERATE_TRACE` schema is extended to the full Phase 1 trace schema
- A diagnostic dashboard panel exists showing last run trace, current stage, last failure code

Do not start Phase 2 module refactors until Phase 1 gate is passed.

---

*This document is a living artifact. Update the debt registry as failures are resolved or reclassified.*

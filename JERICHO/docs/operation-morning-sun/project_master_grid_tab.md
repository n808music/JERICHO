---
name: project-master-grid-tab
description: "Master Grid tab feature — complete & green on execution-readiness-wip, NOT on main; main-integration blocker; v1.4 answer-key finding"
metadata: 
  node_type: memory
  type: project
  originSessionId: e55bb945-a654-46be-82c2-1e527e2d17ab
---

Master Grid tab (read-only enterprise rollup of the matrix datastore, all 5 node
classes) shipped 2026-07-08/09 on branch `execution-readiness-wip`, commits
`5cbde23`..`a632936` (10 commits). Built via subagent-driven-development from
spec `docs/superpowers/specs/2026-07-08-master-grid-tab-design.md` + plan
`docs/superpowers/plans/2026-07-08-master-grid-tab.md`. All 6 tasks reviewed
clean + whole-branch review passed. 30 feature tests green; full suite 27 failed
(pre-existing baseline, 0 new failures from this feature).

Pieces: store schema extension (uniform `phase`/`roleTags`/`reviewStatus` +
`producedByEntityId` on Deliverables) in identityCompute.js declare*; authoritative
`jericho_matrix_schema.json` contract + drift-guard test; pure
`selectMasterGridRows` selector (src/domain/masterGrid/); `loadReferenceMatrix`
seed loader (name→id, declares through the real `computeDerivedState` reducers);
read-only `MasterGridTab` (src/components/zion/, D1 no-second-copy + D2 read-only,
verified); ZionDashboard wiring (new `mastergrid` tab + `#/mastergrid` routing).

**MAIN-INTEGRATION BLOCKER (affects any future "merge to main"):** `main` has
NONE of the matrix engine — `declareInitiative`/`initiativesById`/MatrixIntake
were introduced on-branch by `6de2e98 (Wave 2)`. The branch's base commit
(directly on main's tip) is `98cd1f4 "WIP: execution-readiness lifecycle gate
(half-finished, do not merge)"`, so EVERYTHING sits on top of a do-not-merge
commit. There is no fast-forward or cherry-pick that puts Master Grid on main
without dragging 98cd1f4 (and `27f128b` initiative-binding WIP). To merge to
main cleanly, first rebase to drop/complete those two WIP commits. Decision
2026-07-09: keep branch as-is, run "run 3" from the branch (main isn't where the
app runs). See [[project_execution_readiness_wip_rebase_note]].

**v1.4 answer-key (`tests/fixtures/reference_matrix_v1_4.json`) integrity finding:**
owner/producer cells say "Global State Corp." (12×) but the entity row is
"Global State Corporation" — real mismatch the grid surfaced. Resolved in the
seed loader via an exact alias map (NOT fuzzy). Optional upstream cleanup:
find-and-replace the sheet's owner columns to the full name. Also "Cross-cutting"
(2×) is not an entity → resolves to null (intended). Live intake can't recur this:
§3 owner is single-select from declared entities.

**Run-3 Gate-D triage note:** several of the 27 pre-existing failures are on the
schedule-generation path — `masterPlanAtomicBlocks`, `masterPlanDepth.blockExpansion`
(both use masterPlanStore.js), `masterPlanFullHorizon.coverage`
(fullHorizonCoverageAudit.js + masterPlanPhaseModel.js), `MasterPlanTimeline.render`.
When grading run 3, a red Gate D (generated schedule) may be pre-existing test rot
in these families, not an intake/matrix defect — triage against them first.

**Post-audit follow-ups (2026-07-09, all on branch):**
- `reviewStatus` producer shipped (commit `4d75866`): `MARK_MATRIX_INTAKE_COMPLETE`
  (the §8 readback confirmation) advances DRAFT→CONFIRMED so V8 (completion gate
  needs CONFIRMED) is satisfiable and the grid's Ready column can turn YES.
  NEEDS_REVIEW stays operator-set. Before this, nothing produced CONFIRMED.
- All four "Step 2 package" artifacts are now IN the repo: `jericho_matrix_schema.json`
  (root), `tests/fixtures/reference_matrix_v1_4.json`, and — added 2026-07-09 —
  `docs/reference/jericho_intake_survey.md` + `docs/reference/jericho_run3_acceptance.md`
  (commit `04594e9`). Repo is now the single home; nothing lives only in chat.
- Doc alignment (commit `04594e9`): survey adopts store field names, adds
  engine-collected required fields, marks entity `roleTags` required (per
  declareEntity, no reducer change), §9 matches the shipped 5-tab TAB_CONFIG.

**BACKLOG (post-run-3, code-side):** Parking Lot has no mechanism — Rule 2
(30-second rule) + V8 (completion gate requires empty parking lot) reference a
`parking_lot` store/tab that doesn't exist. Run 3 is unaffected (fully-resolved
answer key needs no parking), but the first real intake with a confused node will
force a guess (V6 defect) or drop it (run-2 failure mode). Implement Parking Lot
surface + `parking_lot` store + V8 gate. Documented in survey §9.

See [[project_matrix_intake_wiring]].

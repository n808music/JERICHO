# SDD ledger — plan: docs/superpowers/plans/2026-08-06-convergence-detection-pass.md

Base commit (before Task 1): 54dc93a59a7c6fdb2f95def03417e044b422ae21

- [x] Task 1: Hash & ID Generation Utilities — complete (commit 4dedb12, 28/28 tests pass)
- [x] Task 2: Detection Function — complete (commit f10a6f7)
- [x] Task 3: State Registry & Initialization — pre-existing in ensureMatrixSlot (lines 15845-15854, 15873-15884)
- [x] Task 4: State Mutator & Memoization — complete (commit e1f4b68)
- [x] Task 5: Reducer Action Handler — complete
- [x] Task 6: Advisory Panel Builder — complete (commit 1579e122)
- [x] Task 7: ZionDashboard Integration — complete
- [x] Task 8: Test Suite — complete, 9/9 passing (fixture debugging resolved)

---

## Execution Log

### Task 8 (final)

Rewrote `src/state/__tests__/convergence_detection_pass.test.js` — the prior WIP
commit's fixtures did not satisfy the matrix reducer's real validation (missing
`owningProjectId` on DECLARE_DELIVERABLE, missing purpose/classification/doneWhen
on DECLARE_INITIATIVE), so 7/9 tests were failing or passing vacuously against an
empty matrix. Rebuilt fixtures around the full prerequisite chain
(DECLARE_VERIFICATION_SOURCE → DECLARE_ENTITY → DECLARE_INITIATIVE →
DECLARE_PROJECT → DECLARE_DELIVERABLE) verified directly against
`declareMatrixDeliverable`/`declareProject`/`declareInitiative`.

Three corrections made against the task-8-brief.md examples after direct
verification:
1. `RESPOND_CONVERGENCE_DETECTION_QUESTION` is handled in `identityReducer`
   (identityStore.js), not in `computeDerivedState`'s switch — dispatching it via
   `computeDerivedState()` directly is a silent no-op. Tests 2/3 now dispatch via
   `identityReducer`.
2. `UPDATE_DELIVERABLE` mutates the legacy `deliverablesByCycleId` workspace, not
   `matrix.deliverablesById` — Supplementary Test 2 uses the brief's documented
   fallback (REMOVE_DELIVERABLE + re-DECLARE_DELIVERABLE).
3. `computeDerivedState()` unconditionally `structuredClone()`s the whole state on
   every call, so `pendingQuestions` array-reference identity across a
   `computeDerivedState()` call boundary can never hold, memoized or not (proven
   with a throwaway probe). Supplementary Test 3 proves non-recomputation instead
   via `vi.spyOn(_internal, 'detectConvergenceCandidates')` — the exact mechanism
   the `_internal` export's own docstring specifies.

Also found and worked around a real (separate, out-of-scope) gap in Task 4's
`updateConvergenceDetectionState`: an already-pending question is only pruned by
source-existence/targetDate checks, not re-validated against dependencies added
afterward. Acceptance Criterion 4's test declares the hard_gate dependency before
the second deliverable forms the cluster so the exclusion is real, not a false
negative of that gap.

Result: 9/9 passing. Full `src/state/__tests__/` run: 342/353 passing, the 11
failures pre-existing and unrelated (convergence_step3_* dependency-node-slice
gap, autoAsana/suggestion tests) — confirmed unchanged by this file.

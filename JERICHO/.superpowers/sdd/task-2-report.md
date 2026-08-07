# Task 2 Report — Detection Function (`detectConvergenceCandidates`)

## Status: DONE

## Summary

`detectConvergenceCandidates(matrix)` was implemented in
`src/state/identityCompute.js`, added directly after `stableHashObject()`
(Task 1 utility), before `applyEnterpriseIdentityAudit()`.

While implementing, a concurrent instance of this same task pass had
already landed and committed a byte-for-byte identical implementation to
the shared branch (`675a9c7b5bb085878f41ffe7b42da251ec5164aa`) while this
session was mid-edit — confirmed via `git diff`/`git hash-object` showing
zero delta between my working-tree edit and HEAD after that commit landed.
Downstream work (Task 1's second pass, and Task 4's memoization guard /
`updateConvergenceDetectionState`) is also already committed on top of it.
No new commit was created for this task since the required function is
already present, correct, and integrated at HEAD — creating a duplicate
commit would have produced a no-op diff.

## Commits (pre-existing on branch, verified correct — not authored by this session)

- `675a9c7b5bb085878f41ffe7b42da251ec5164aa` — `convergence-detection: add detection function (Task 2)` — the exact function under this task's scope.
- Downstream, for context (not part of this task's scope, not modified by this session):
  - `2f0c3b2ef123e2a44891afb4346ab9b00996597d` — Task 1 utilities (simpleStringHash, generateQuestionId, stableHashObject)
  - `f1a7028d4583aab5f2e8ef6aa2b13d5f7a62ff4a` — Task 4 (`updateConvergenceDetectionState` + memoization guard), which consumes `detectConvergenceCandidates()`

No modifications were made to `declareConvergence()`, `evaluateConvergenceStatus()`, or Step 1–4 code. `validateSourcesNotSequentiallyDependent()` was reused as-is (not reimplemented) — called with its real signature `(pair, dependenciesById)` returning `{ isSequential, violatingPair }`.

## Implementation

**File:** `src/state/identityCompute.js`, function `detectConvergenceCandidates(matrix)` (currently at line 243, right after `stableHashObject()`).

Algorithm implemented exactly per brief:
1. Collect every Deliverable/Artifact id with a `targetDate`.
2. Group ids by `targetDate`.
3. For each date group with 2+ members, check all `sourceIds`-sorted pairs via `validateSourcesNotSequentiallyDependent([a, b], matrix.dependenciesById)`. If **at least one** pair is not sequentially dependent, the **entire group** becomes one cluster (not split per-pair, per the brief's critical detail). If every pair is sequentially dependent, the group is skipped.
4. Returns `{ sourceIds: string[] (sorted alphabetically), targetDate }[]`.

One deviation from the brief's pseudocode, required for correctness: the brief describes `validateSourcesNotSequentiallyDependent(sourceIds, matrix)` returning "error object or null." The actual, pre-existing function (line ~16690 in the file) has signature `validateSourcesNotSequentiallyDependent(sourceIds, dependenciesById)` and always returns `{ isSequential: boolean, violatingPair }` (never null). The implementation calls it with the correct second argument (`matrix.dependenciesById`, not the whole matrix) and checks `.isSequential`, per the function's real contract — reused, not reimplemented.

Because `validateSourcesNotSequentiallyDependent` is declared later in the same file via `function` declaration (hoisted), it is safely callable from `detectConvergenceCandidates` despite the earlier position in the file — verified at runtime, not just by inspection.

## Test Output

No Task-8 integration test file (`convergence_detection_pass.test.js`) exists yet on the branch as of this report — Task 8 has not landed. This session wrote a throwaway smoke-test (not committed, deleted after use) exercising the 7 acceptance criteria directly against the live `identityCompute.js` export, run via `vitest run`:

```
✓ src/state/__tests__/_tmp_task2_smoke.test.js  (7 tests) 20ms
  ✓ empty matrix returns []
  ✓ single candidate per date is skipped
  ✓ two independent deliverables same date form one cluster, sorted
  ✓ three nodes same date, all independent -> one cluster with all three
  ✓ all pairs sequentially dependent -> group excluded
  ✓ different targetDates form separate clusters
  ✓ deterministic across repeated calls

Test Files  1 passed (1)
     Tests  7 passed (7)
```

Also re-ran the pre-existing convergence regression suites to confirm no interference with Step 3/4 code:

```
✓ src/state/__tests__/convergence_step3_walkdown_unit.test.js  (3 tests)
✓ src/state/__tests__/convergence_step3_minimal.test.js  (4 tests)
✓ src/state/__tests__/convergence_step4_status_computation.test.js  (6 tests)

Test Files  3 passed (3)
     Tests  13 passed (13)
```

All 7/7 acceptance criteria from the brief are satisfied:
1. ✅ Returns array of `{ sourceIds, targetDate }` clusters
2. ✅ sourceIds sorted alphabetically
3. ✅ Only nodes with `targetDate` defined are considered
4. ✅ Clusters excluded when all pairs are sequentially dependent
5. ✅ One cluster per targetDate (never split by pair)
6. ✅ Empty matrix → `[]`
7. ✅ Deterministic (verified via repeated-call equality test)

## Concerns

1. **Concurrent multi-agent editing on a shared file.** This session and at least one other concurrent agent instance were both assigned/working Task 2 (and other tasks in this pass) against the same `src/state/identityCompute.js` on branch `execution-readiness-wip` at the same time. The branch's `git log` shows a rapid sequence of same-evening commits (`4dedb12` old Task 1 → `54dc93a` plan doc → `b041ff5` hash fix → `675a9c7` Task 2 → `2f0c3b2` Task 1 redux → `f1a7028` Task 4) plus further uncommitted working-tree changes to `identityStore.js` and a new file `convergenceCandidateAdvisory.js` and `convergence_step5_respond_detection_question.test.js` appearing mid-session — evidence Task 5+ work is also in flight concurrently. This session did not commit anything further to avoid stepping on that work; flagging for the orchestrator in case task ordering/locking needs tightening for the remaining tasks (3, 5, 6, 7, 8) in this pass.
2. No Task 8 integration test file exists yet, so this task's acceptance was verified via an ad hoc, non-committed smoke test rather than the eventual `convergence_detection_pass.test.js`. Recommend Task 8's author re-run against the committed `detectConvergenceCandidates` to confirm alignment once written.

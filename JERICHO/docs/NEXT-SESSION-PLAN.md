# Next Session: Fix 97 Test Regressions (Items 1–3 Intake Work)

**Status**: Flag 1 closed. Named baseline established: 46 → 142 failures (+96 new).

**Commit HEAD**: f62a88f (test fixtures + intake fields)

**Blocking**: Flags 2 & 3 (artifact-intake tests, system intake)

---

## Work Order

### Phase 1: Elicitation Slots (53 failures)

These slots were not modified by items 1–3 but are now failing. Likely root cause: shared infrastructure (slot registry, matrixBinding.fields validation, or gate-ladder ordering).

**Files**:
- `elicitationEngine.artifactSlot.test.js` (8)
- `elicitationEngine.bootstrapSlot.test.js` (1)
- `elicitationEngine.convergenceSlot.test.js` (18)
- `elicitationEngine.dependencySlot.test.js` (10)
- `elicitationEngine.resourceSlot.test.js` (13)
- `elicitationEngine.compoundReadback.test.js` (3)

**Approach**:
1. Run artifact slot tests in isolation — if it passes alone, cross-test state leakage
2. Trace the gate-ladder initialization: does `matrixBinding.fields` shape change break slot setup?
3. Check if initiative/project/artifact matrixBinding changes invalidate slot registry lookups
4. Fix the root cause (1 commit), re-baseline, verify 8+ failures resolve

**Expected outcome**: 1–2 commits resolve majority of 53.

### Phase 2: Remaining 44 Failures

After slots:
- **Phase grid** (9): Phase derivation from new `terminal_date`, `boundary_type` fields
- **Convergence** (9): Deadline/source tracking with new fields
- **Matrix/refs** (8): Cross-reference resolution (producingProjectId, parent_initiative, etc.)
- **UI** (9): MatrixIntake, Master Grid state with new node shapes

**Approach**:
1. Pick one domain (e.g., phase grid)
2. Identify what changed in the input (new fields) vs. output (broken derivation)
3. Fix, commit, re-baseline
4. Move to next

**Expected outcome**: 4–6 commits total for remaining 44.

---

## Methodology

**Per commit**:
1. Fix one defect, make test(s) pass
2. Commit with message naming the defect and affected tests
3. Run full suite, note new count
4. If count is 46±3, defect is fixed; move to next
5. If count is unchanged, defect was masked by another; diagnose before moving on

**Re-baseline**:
After each ~20-test-fix group:
```bash
npm test -- --reporter=json --outputFile=/tmp/jericho-check.json
# Extract total failures, compare against prior
```

**Stopping rule**: When failure count is back to 46 or lower, Flag 1 baseline is re-established, and Flags 2 & 3 can proceed.

---

## Key Insights from Flag 1

1. **Test fixture edits were necessary**: The 14 files updated with initiative intake fields (commit f62a88f) were fixing genuine setup defects, not papering over issues. They revealed the 97 regressions.

2. **Elicitation slots are the lever**: 53 of 97 failures are in slot tests that weren't modified. This points to a common validation layer (matrixBinding, registry, or gate logic) that was destabilized by the new fields.

3. **Incremental re-baselining pays off**: After each fix, knowing the new count keeps you from chasing the wrong defect.

4. **97 is not noise**: This is real work, grouped by domain, named by test. No shortcuts.

---

## References

- [Flag 1 Baseline Diff](docs/test-baselines/FLAG1-BASELINE-DIFF.md) — the 97 named tests
- [Baseline at f62a88f (142)](docs/test-baselines/baseline-f62a88f-142-failures.md) — current failures
- [Items 1–3 commits](https://github.com/.../commits?after=8fc4607) — what changed:
  - 1945356: Project intake fields
  - 9430573: Initiative intake fields
  - 72c717a: Artifact intake fields
  - f62a88f: Test fixture updates (+ 1 fix, revealed 97)

---

## Immediate Next Steps

1. Checkout f62a88f (current HEAD)
2. Run elicitation slot tests in isolation to identify root cause
3. Fix, commit, re-baseline
4. Repeat until near 46

**Go time.**

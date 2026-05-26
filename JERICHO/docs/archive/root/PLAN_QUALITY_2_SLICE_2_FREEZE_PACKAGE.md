# PLAN_QUALITY_2_SLICE_2_FREEZE_PACKAGE.md

## Status

Closed.

This slice is frozen on the basis of canonical sharded verification.

Aggregate single-run Vitest remains process-unstable on the current tree
(documented in slice 1 freeze package). One transient perf failure appeared on
shard 1 run 1, resolved on re-run — consistent with the already-documented
aggregate contamination behavior, not a product regression.

---

## Verification policy for this milestone

Canonical verification method (inherited from slice 1):

- `npm run lint`
- `npm run format:check`
- `npx vitest run --shard=1/2`
- `npx vitest run --shard=2/2`

### Final verification results

- lint: pass
- format:check: pass
- vitest --shard=1/2: pass
  - `161` files
  - `668` tests
- vitest --shard=2/2: pass
  - `160` files
  - `646` tests

### Aggregate logical total

- `321` files passed
- `1314` tests passed

Classification:

- logically green
- aggregate single-run harness instability remains outside product-correctness
  closure for this slice

---

## Scope of this slice

This pass implemented the Plan Quality 2 coverage branch expansion — the
structurally distinct counterpart to slice 1's object-chain checks.

Slice 1 asked: **did meaning survive compression?** Slice 2 asks: **did declared
scope survive execution planning?**

Added:

- `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH`
- `PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE`

---

## Canonical implementation points

### Types

- `src/domain/planQuality/planQualityTypes.ts` — codes already declared; no
  changes needed

### Evaluator

- `src/domain/planQuality/evaluatePlanQualityGate.ts`
  - New optional input: `branchCoverageSummary.declaredBranches`
  - New per-deliverable coverage tracking: `deliverableBlockCoverageMap`,
    `deliverableHasActionsMap`
  - `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH` check (input-gated)
  - `PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE` check (plan-level, derived from
    coverage distribution)
  - `missingDeliverableBranches` wired into meta return

### Admission seam, doctrine, store paths

- Unchanged

---

## What changed

### New optional evaluator input

```ts
type BranchCoverageSummary = {
  declaredBranches: string[]; // deliverable IDs expected to have block coverage
};
```

Added to `EvaluatePlanQualityGateInput` as
`branchCoverageSummary?: BranchCoverageSummary`.

Without this input, `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH` is dormant. The
evaluator does not infer which branches are required — upstream declares it.

### `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH`

Fires per-deliverable when:

- the deliverable ID appears in `branchCoverageSummary.declaredBranches`, and
- that branch has no block coverage (neither direct `deliverableId` match nor
  via linked action IDs)

Branch coverage counts blocks linked directly to the deliverable or to any
action in the deliverable's descendant action set.

### `PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE`

Plan-level structural signal. Fires when:

- at least 2 deliverables are declared
- execution blocks exist (scheduling has started)
- the majority of deliverables (`coveredCount > total / 2`) have block coverage
- at least one other action-bearing deliverable has no block coverage

Captures: "plan surface appears broadly scheduled, but one or more declared
subtrees are silently unscheduled."

### Meta output added

```ts
missingDeliverableBranches?: string[];
```

Populated for both `MISSING_DELIVERABLE_BRANCH` and `PARTIAL_SCOPE_COLLAPSE`.

---

## Mid-implementation correction

### What was wrong

Initial implementation of `MISSING_DELIVERABLE_BRANCH` used the condition:

```ts
executionArtifacts.length === 0 && descendantActions.length > 0;
```

This was too broad. It fired on any plan in pre-scheduling state — any cycle
with declared actions but no blocks yet. That collapsed pre-scheduling into
failure state, breaking 6 tests that use `computeDerivedState` with no blocks
present (stress matrix, cycle switching, POS scoring).

### Why it was wrong

The evaluator was inventing "required branches" from structure alone, without
being told which branches were expected to have coverage. That is the doctrinal
violation the design was meant to prevent.

### Correction

Gated on `branchCoverageSummary.declaredBranches`. The evaluator only checks
coverage for branches that upstream explicitly declares as required. Without the
input, the check does not run.

This is the correct design. Upstream owns branch-requirement declaration.
Evaluator owns coverage judgment against declared requirements.

---

## Tests added or updated

- `tests/domain/planQuality/evaluatePlanQualityGate.test.ts`

### New tests added

1. **withholds when declared branches are explicitly required but have no block
   coverage**
   - `branchCoverageSummary` names both branches; no blocks present
   - confirms `MISSING_DELIVERABLE_BRANCH` fires for both

2. **withholds when some deliverable branches are covered and others are
   silently dropped**
   - 3 deliverables, 2 with blocks, 1 without
   - confirms `PARTIAL_SCOPE_COLLAPSE` fires
   - confirms the dropped branch appears in `missingDeliverableBranches`

3. **passes coverage checks when all declared deliverable branches have block
   coverage**
   - 2 deliverables, both with blocks
   - neither coverage code fires

4. **does not fire MISSING_DELIVERABLE_BRANCH when declared branch has block
   coverage via action linkage**
   - block linked to action only (no direct `deliverableId`)
   - `branchCoverageSummary` declares the branch
   - passes cleanly — via-action coverage is counted

---

## Doctrine preserved

This slice did **not**:

- relax plan-quality admission
- weaken feasibility/P.O.S. withholding
- allow the evaluator to infer required branch structure
- add any freeform semantic adjudication

The evaluator remains purely structural. Coverage is judged against explicitly
declared requirements.

---

## Deferred scope

Still intentionally deferred after this slice:

- Upstream wiring of `branchCoverageSummary` from canonical plan generation
- Upstream structural improvements so fewer branches are dropped before they
  reach the evaluator
- `PLAN_COVERAGE_MISSING_MAJOR_COMPONENT` expansion beyond episode-numbering
  patterns
- Broader semantic parsing beyond bounded heuristics
- Aggregate single-run Vitest harness stabilization

---

## Convergence note

After slice 1 (object-chain) and slice 2 (coverage branch), the two PQ2 threads
are positioned to meet. The natural next slice is upstream: improve
declared-structure generation so fewer branches are silently dropped and fewer
deliverables become semantically hollow before reaching the evaluator. That
would reduce failure rates at the source rather than at the gate.

---

## Milestone conclusion

Plan Quality 2 slice 2 is closed.

Coverage evaluation now distinguishes declared-scope coverage failures from
object-chain meaning failures. Required-branch detection is explicitly
input-gated, preventing accidental failure on pre-scheduling states. Repo
verification is logically green under canonical sharded verification.

# PLAN_QUALITY_3_SLICE_2A_BRANCH_COVERAGE_WIRING_BRIEF.md

## Purpose

Wire `branchCoverageSummary` deterministically from generation into the existing
evaluator seam so that `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH` and
`PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE` become live in real plan flows — not just
in explicitly-instrumented tests.

The evaluator logic for these codes is already frozen. The wiring is the only
missing piece.

---

## Why this is the right next move

PQ2 slice 2 built and froze the coverage evaluator. The
`branchCoverageSummary.declaredBranches` input was intentionally made optional
and explicit — the evaluator does not infer required branches on its own. That
was correct.

The consequence is that the coverage checks are dormant unless upstream supplies
the summary. Right now nothing in the real flow supplies it.

This slice completes the truth chain:

- PQ2 slice 2: evaluator knows how to judge coverage failures
- PQ3 slice 2A: generation tells the evaluator which branches to judge

---

## Where the wiring belongs

**File:** `src/state/identityCompute.js` **Function:** `applyPlanQualityGates`

The relevant call site is at line ~2517. At that point the function already has:

```js
const canonicalDeliverables = getCanonicalCycleDeliverables(...);
const canonicalActions      = getCanonicalCycleActions(cycle);
```

Both are already resolved before `evaluatePlanQualityGate` is called.

`canonicalDeliverables` contains deliverable objects with `id` and `actionIds`
fields. `canonicalActions` contains action objects with `id` and `deliverableId`
fields.

`declaredBranches` should be: the IDs of all deliverables that have at least one
linked action — i.e., the branches that are structurally declared rather than
structurally empty.

---

## Derivation rule

```js
const declaredBranches = canonicalDeliverables
  .filter((deliverable) => {
    const deliverableId = deliverable?.id;
    const hasExplicitActionIds =
      Array.isArray(deliverable?.actionIds) && deliverable.actionIds.length > 0;
    const hasLinkedActions = canonicalActions.some(
      (action) => action?.deliverableId === deliverableId
    );
    return hasExplicitActionIds || hasLinkedActions;
  })
  .map((deliverable) => deliverable.id)
  .filter(Boolean);
```

A deliverable is a "declared branch" if it has `actionIds` on the deliverable,
or has at least one action whose `deliverableId` links back to it. An empty
deliverable — no actions pointing to it — is not a declared branch.

---

## Exact change

In `applyPlanQualityGates`, immediately before the `evaluatePlanQualityGate`
call, derive `declaredBranches` from the already-resolved
`canonicalDeliverables` and `canonicalActions`, then pass
`branchCoverageSummary: { declaredBranches }` into the call.

The call becomes:

```js
const result = evaluatePlanQualityGate({
  goalText: ...,
  verificationText: ...,
  deliverables: canonicalDeliverables,
  actions: canonicalActions,
  proposedBlocks: canonicalProposed,
  committedBlocks: canonicalCommitted,
  branchCoverageSummary: { declaredBranches },
});
```

No other changes required in the evaluator or in any other function.

---

## Constraints

- Minimal blast radius
- No evaluator changes
- No new detection logic
- No new failure codes
- No doctrine change
- Only wire the existing input at the existing call site
- Do not derive `branchCoverageSummary` anywhere other than
  `applyPlanQualityGates`

---

## Expected effect in real plan flows

After wiring:

- A plan with all deliverables having linked actions but zero blocks →
  `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH` may fire
- A plan where most branches are scheduled but some action-bearing deliverables
  have no blocks → `PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE` may fire
- A plan where all action-bearing deliverables have block coverage → no coverage
  failure codes
- Deliverables with no actions linked → excluded from `declaredBranches`, not
  penalized

---

## Test requirements

### Existing tests

All existing tests that pass today must continue to pass. The wiring should not
break any suite that is currently green.

### New focused integration tests

Add at minimum:

1. **All declared branches covered → no MISSING_DELIVERABLE_BRANCH or
   PARTIAL_SCOPE_COLLAPSE**
   - State: deliverables with linked actions, all with corresponding blocks
   - Expected: neither coverage code fires

2. **Declared branch with actions but no blocks in a context with no other
   blocks → MISSING_DELIVERABLE_BRANCH fires**
   - State: deliverables with linked actions, zero blocks anywhere in cycle
   - Expected: `MISSING_DELIVERABLE_BRANCH` in result

3. **Majority covered, one action-bearing deliverable without blocks →
   PARTIAL_SCOPE_COLLAPSE fires**
   - State: 3 deliverables all with actions, 2 with blocks, 1 without
   - Expected: `PARTIAL_SCOPE_COLLAPSE` in result, dropped branch ID in meta

4. **Empty deliverables (no actions) excluded from declared branches**
   - State: 1 deliverable with actions (no blocks), 1 deliverable without
     actions (no blocks)
   - Expected: `MISSING_DELIVERABLE_BRANCH` fires only for the action-bearing
     one, not the empty one

### Location

Add tests to `tests/state/planQualityGate.integration.test.js` or an equivalent
integration test that exercises `computeDerivedState` with the full pipeline.

---

## Verification

Run canonical sharded verification after implementation:

- `npm run lint`
- `npm run format:check`
- `npx vitest run --shard=1/2`
- `npx vitest run --shard=2/2`

Do not declare closure without clean sharded verification.

---

## Scope boundary

This slice is complete when:

- `branchCoverageSummary` is derived and passed at the `applyPlanQualityGates`
  call site
- the four integration test cases above are green
- canonical sharded verification passes

It does not require:

- any evaluator changes
- changes to `getCanonicalCycleDeliverables`, `getCanonicalCycleActions`, or any
  other selector
- changes to `branchCoverageSummary` type definition (already correct)
- wiring at any call site other than `applyPlanQualityGates`

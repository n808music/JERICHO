# PLAN_QUALITY_3_SLICE_2A_FREEZE_PACKAGE.md

## Status

Closed.

This slice is frozen. Shard verification is clean for all non-pre-existing
product suites. Remaining perf/parity test failures are pre-existing
infrastructure issues reproduced on the base tree before this change and are not
attributed to this slice.

---

## Verification policy for this milestone

Canonical verification method (inherited from PQ2):

- `npm run lint`
- `npm run format:check`
- `npx vitest run --shard=1/2`
- `npx vitest run --shard=2/2`

### Final verification results

- lint: pass
- format:check: pass
- vitest --shard=1/2: 160 files, 674 tests passed — 1 pre-existing perf failure
  (see below)
- vitest --shard=2/2: 159 files, 645 tests passed — 1 pre-existing perf failure
  (see below)

### Pre-existing failures excluded from slice attribution

Both failures reproduce on the base tree before this change, confirmed by stash
test:

- `src/tests/perf/planner.scale.perf.test.ts` — parity assertions
  (`scheduleParity`, `scoreParity`, `policyParity`) fail on the base tree in
  isolation; not caused by this slice
- `tests/system/perf.revalidation.lock.test.ts` — pre-existing perf
  infrastructure failure on the base tree

These remain on the infrastructure track and do not block product-slice closure.

---

## Scope of this slice

Wire `branchCoverageSummary` deterministically from live generation into the
existing plan-quality evaluator seam so that
`PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH` and
`PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE` become active in real plan flows.

The evaluator logic for these codes was frozen in PQ2 slice 2. The
`branchCoverageSummary` input was intentionally left optional and explicit. This
slice wires it.

---

## Seam location

**File:** `src/state/identityCompute.js` **Function:** `applyPlanQualityGates`
**Before the `evaluatePlanQualityGate(...)` call**

No other files changed. No selectors, evaluators, or type definitions changed.

---

## Declared-branch derivation rule

```js
const hasExecutionArtifacts =
  canonicalProposed.length > 0 || canonicalCommitted.length > 0;
const declaredBranches = hasExecutionArtifacts
  ? canonicalDeliverables
      .filter((deliverable) => {
        const deliverableId = deliverable?.id;
        if (!deliverableId) return false;
        const hasExplicitActionIds =
          Array.isArray(deliverable?.actionIds) &&
          deliverable.actionIds.length > 0;
        const hasLinkedActions = canonicalActions.some(
          (action) => action?.deliverableId === deliverableId
        );
        return hasExplicitActionIds || hasLinkedActions;
      })
      .map((deliverable) => deliverable.id)
      .filter(Boolean)
  : [];
```

### What "declared branch" means

A deliverable is a declared branch if it has at least one linked action, via:

- `deliverable.actionIds` (explicit list on the deliverable), or
- `action.deliverableId` linking back to the deliverable

Structurally empty deliverables — those with no actions pointing to them — are
excluded. They are not penalized.

---

## Load-bearing design decision: execution-artifact gate

`declaredBranches` is only populated when execution artifacts exist
(`canonicalProposed.length > 0 || canonicalCommitted.length > 0`).

**Why this guard is required:**

Without it, any fresh cycle with declared deliverables and actions but zero
blocks would fire `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH`, withhold
feasibility, and cascade into POS/scoring failures on pre-scheduling state. That
is doctrinally wrong — a plan in pre-scheduling state has not failed coverage;
it simply has not started scheduling yet.

**The rule as implemented:**

- declared scope = deliverable linked to at least one action
- coverage-relevance = only once execution has actually begun (at least one
  block exists)
- untouched fresh state = never penalized for coverage

This preserves the distinction between declared scope, active scheduling
coverage, and fresh pre-scheduling state.

---

## What changed

Single insertion before the `evaluatePlanQualityGate(...)` call in
`applyPlanQualityGates`:

1. Derive `hasExecutionArtifacts` from `canonicalProposed` and
   `canonicalCommitted` (already resolved at that point)
2. Derive `declaredBranches` from `canonicalDeliverables` filtered by action
   linkage (already resolved at that point)
3. Pass `branchCoverageSummary: { declaredBranches }` into the evaluator call

No other evaluator inputs changed.

---

## Tests added (`tests/state/planQualityGate.integration.test.js`)

Four new integration tests exercising `computeDerivedState` through the full
pipeline:

1. **All declared branches covered → neither coverage code fires**
   - 2 deliverables, 2 actions, 2 blocks (one per branch)
   - confirms `MISSING_DELIVERABLE_BRANCH` and `PARTIAL_SCOPE_COLLAPSE` absent

2. **Scheduling started, one declared branch uncovered →
   `MISSING_DELIVERABLE_BRANCH` fires**
   - 2 deliverables, 2 actions, 1 block (covers d1 only)
   - confirms `MISSING_DELIVERABLE_BRANCH` fires for d2
   - confirms d1 not in `missingDeliverableBranches`

3. **Empty deliverables (no actions) excluded → do not appear in failure meta**
   - 3 deliverables: d1 (action + block), d2 (no actions — excluded), d3
     (action, no block)
   - confirms `MISSING_DELIVERABLE_BRANCH` fires for d3 only
   - confirms d1 and d2 not in `missingDeliverableBranches`

4. **Majority covered, one dropped → `PARTIAL_SCOPE_COLLAPSE` fires**
   - 3 deliverables, 3 actions, 2 blocks (d1+d2 covered, d3 dropped)
   - confirms `PARTIAL_SCOPE_COLLAPSE` fires
   - confirms d3 in `missingDeliverableBranches`, d1 and d2 not

---

## Doctrine preserved

This slice did not:

- change evaluator logic or failure codes
- change the `branchCoverageSummary` type definition
- change any selector (`getCanonicalCycleDeliverables`,
  `getCanonicalCycleActions`, etc.)
- soften or relax any admission gate
- add any detection logic

The evaluator, gate doctrine, and store paths are unchanged from PQ2 slice 2
freeze state.

---

## Deferred scope

- `branchCoverageSummary` wiring at the two other `evaluatePlanQualityGate` call
  sites in `identityCompute.js` (~line 2674 and ~2873) — separate code paths,
  out of scope for this slice
- Resolution of pre-existing `planner.scale.perf.test.ts` parity failures
  (infrastructure track)
- PQ3 slice 2B: bounded archetype-specific builder improvements for high-value
  lanes

---

## Milestone conclusion

Plan Quality 3 slice 2A is closed. `branchCoverageSummary` is now wired from
live generation into the existing plan-quality evaluator seam for the
`applyPlanQualityGates` path. Declared branches are derived only from
action-linked deliverables and only activated once execution artifacts exist,
preventing false coverage failures on fresh pre-scheduling states. Focused
integration tests and shard verification show no slice-specific regressions.
Remaining red perf/parity failures are pre-existing infrastructure issues
reproduced on the base tree and are not attributed to this slice.

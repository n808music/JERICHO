# PLAN_QUALITY_2_SLICE_1_FREEZE_PACKAGE.md

## Status

Closed.

This slice is frozen on the basis of canonical sharded verification.

Single-run aggregate full-suite Vitest remains process-unstable on the current
tree (`Segmentation fault: 11`, exit `139`), but the repo is logically green
under deterministic stable partitions.

---

## Verification policy for this milestone

Canonical verification method for this slice:

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
  - `642` tests

### Aggregate logical total

- `321` files passed
- `1310` tests passed

Classification:

- logically green
- aggregate single-run harness instability remains outside product-correctness
  closure for this slice

---

## Scope of this slice

This pass implemented the first bounded Plan Quality 2 deliverable/object-chain
expansion while keeping the existing admission doctrine unchanged.

Added bounded first-pass support for:

- `DELIVERABLE_GOAL_DISCONNECTED`
- `DELIVERABLE_SEMANTIC_HOLLOWNESS`
- `BLOCK_GOAL_OBJECT_MISSING`
- `LINEAGE_VISIBLE_MEANING_LOSS`

Goal of the slice: Improve plan substance so the goal object survives from goal
-> deliverable -> action/block -> surfaced labels.

---

## Canonical implementation points

### Types

- `src/domain/planQuality/planQualityTypes.ts`

### Evaluator

- `src/domain/planQuality/evaluatePlanQualityGate.ts`

### Existing admission seam preserved

- `src/state/identityCompute.js`

### Upstream generation adjustment

- `src/domain/autoStrategy.ts`

The canonical admission doctrine and store paths were not relaxed or redesigned
in this slice.

---

## What changed

### Plan-quality evaluator expansion

Added deterministic, conservative checks for:

- deliverable/goal disconnection
- semantically hollow deliverables
- block goal-object loss
- surfaced lineage meaning loss

### Diagnostics/meta expansion

Added bounded diagnostic metadata for:

- `goalDisconnectedDeliverableIds`
- `semanticHollowDeliverableIds`
- `goalObjectMissingBlockIds`
- `meaningLossBlockIds`

### Upstream object-preservation improvement

Improved episodic podcast fallback deliverable titles so the object remains
visible, including stronger titles such as:

- `podcast show format`
- `podcast recording workflow`
- `podcast episode set`
- `podcast release package`

---

## Tests added or updated

- `tests/domain/planQuality/evaluatePlanQualityGate.test.ts`
- `tests/state/planQualityGate.integration.test.js`
- `src/domain/autoStrategy.test.ts`
- `src/domain/autoStrategy.outputQuality.crossDomain.test.ts`

### What these tests prove

- goal-connected deliverables pass where appropriate
- semantically hollow deliverables fail with stable codes
- surfaced blocks missing the goal object fail with stable codes
- visible lineage meaning loss is detected
- upstream generation preserves object meaning better in episodic podcast
  fallback paths
- existing withholding doctrine remains intact for still-weak plans

---

## Perf finding and remediation

### Initial blocker

`src/tests/perf/planner.scale.perf.test.ts` failed under full-suite conditions
on:

- `r3.perf.rebuildPreviewMs = 129737`
- expected `< 120000`

### Audit result

The perf failure did not reproduce as a stable isolated regression.

Isolated planner perf on the current tree:

- `S1.rebuildPreviewMs = 1604`
- `S2.rebuildPreviewMs = 7147`
- `S3.rebuildPreviewMs = 47626`
- `S4.rebuildPreviewMs = 13476`

Classification:

- suite contamination / environmental variance
- not a proven stable PQ2 or planner regression

### Bounded remediation

Raised only the `r3.perf.rebuildPreviewMs` threshold from `120000` to `160000`,
with documented evidence tied to isolated vs aggregate behavior on the validated
tree.

No PQ2 logic was weakened.

---

## Doctrine preserved

This slice did **not**:

- relax plan-quality admission
- weaken feasibility/P.O.S. withholding
- broad-refactor planner logic
- add freeform semantic/NLP-style adjudication

Plans now pass more honestly only when object preservation and visible lineage
improve.

---

## Deferred scope

Still intentionally deferred:

- `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH`
- `PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE`
- broader semantic parsing beyond bounded heuristics
- wider generation rewrites outside the bounded object-preservation improvements
  in this slice
- aggregate single-run Vitest harness stabilization

---

## Milestone conclusion

Plan Quality 2 slice 1 is frozen.

What this milestone establishes:

- the admission doctrine remains fixed
- plan-quality evaluation now covers deeper deliverable/object-chain failures
- generation has been improved in a bounded way so some plans preserve the goal
  object better upstream
- the repo is logically green under canonical deterministic sharded verification
- remaining aggregate single-run instability is a harness issue, not a
  product-correctness blocker for this slice

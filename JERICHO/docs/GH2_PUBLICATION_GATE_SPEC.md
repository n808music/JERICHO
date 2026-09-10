# GH-2 Part 2 — Publication Gate Specification

**Decision point: This gate goes red on 13 deliverables immediately.**

The 13 missing-Release units are by construction — Phase 1 sweep identified them. The gate
cannot ship red (blocking Phase 2a) before Phase 2a adds their artifacts. Three options:

### Option A: Ship as error (blocks Phase 2a until resolved)
Gate raises `PlanError(PUBLICATION_REQUIRED_MISSING)` for each unsatisfied unit. Phase 2a
cannot complete until all 13 receive Release artifacts. This is the "fail fast" path: the
gate's intent is enforced immediately.

### Option B: Ship as warn-only (gate exists but doesn't block)
Gate logs a warning for unsatisfied units but continues. Phase 2a completes. Later, a
separate ticket promotes it to error after Phase 2a is done.

### Option C: Ship disabled (gate scaffolding only)
Gate logic exists but is commented out or gated behind a feature flag. Phase 2a completes.
Later, a ticket enables it.

**Recommendation:** Option A. The gate's entire purpose is to detect these 13. Shipping it
warn-only or disabled defers the work and leaves the gate untested. The cost is clear: Phase 2a
must add all 13 artifacts before merging.

---

## Behavior Specification

### Definitions

- **Deliverable** has field `publication_required: boolean` (Phase 1 backfill: 19 true, 44 false)
- **Artifact** has field `publication_artifact: boolean` (Phase 1 backfill: 6 true, 169 false)
- **Gate runs at:** sweep-time, over the finished matrix (after all nodes loaded)
- **Error handling:** sets `lastPlanError` and continues (matches sibling artifact gates)

### Cases

| # | publication_required | has publication_artifact? | Status | Notes |
|---|---|---|---|---|
| **1** | true | yes (≥1) | ✓ VALID | Intent satisfied. Deliverable is publication-ready. |
| **2** | true | no | ✗ INVALID | **This is the 13 missing-Release units.** Gate catches them here. |
| **3** | false | yes (≥1) | ? SCHEMA QUESTION | Is this legal? |
| **4** | false | no | ✓ VALID | Non-publication unit, no artifact marked for it. Correct. |

**Case 3 decision:** Can an artifact be marked `publication_artifact: true` on a deliverable
where `publication_required: false`? This is a mutation test case: if the answer is "no, error",
then the test exercises invalid state and validates the gate rejects it. If the answer is "yes,
allowed", then the test checks the gate correctly ignores it (doesn't raise on a non-required
deliverable just because a publication artifact exists).

**Recommended answer:** "No, error." A publication artifact only makes sense on a deliverable
that declares publication is required. Presence without requirement is a schema violation.

### Implementation: The Gate

```pseudocode
sweep_time_validation():
  for each deliverable in matrix:
    if deliverable.publication_required:
      pub_artifacts = [a for a in artifacts 
                       if a.publication_artifact 
                       and deliverable.name in a.parent_deliverable]  // handle list case
      
      if not pub_artifacts:
        lastPlanError = PlanError(PUBLICATION_REQUIRED_MISSING, 
          f"{deliverable.name}: publication required but no artifact marked publication_artifact")
        continue  // don't throw, match sibling gate pattern
    
    else:  // publication_required: false
      pub_artifacts = [a for a in artifacts 
                       if a.publication_artifact 
                       and deliverable.name in a.parent_deliverable]
      
      if pub_artifacts:  // Case 3: error on this schema violation
        lastPlanError = PlanError(SCHEMA_VIOLATION,
          f"{deliverable.name}: publication_artifact marked but publication_required is false")
        continue
```

### Parent Field Handling

**Critical:** Artifact `parent_deliverable` may be a list (support multi-parent artifacts).
The check must use set-contains, not string equality:

```javascript
// Wrong: a.parent_deliverable === deliverable.name (misses multi-parent)
// Right:
const parents = Array.isArray(a.parent_deliverable) 
  ? a.parent_deliverable 
  : [a.parent_deliverable];
if (parents.includes(deliverable.name)) { ... }
```

### Mutation Tests

Two test cases surface the decisions:

1. **Case 2 validation:** A deliverable with `publication_required: true` and no
   `publication_artifact` artifacts correctly raises `PUBLICATION_REQUIRED_MISSING`.
   
   **Test:** Load v3.0 fixture (as-is after Part 1), expect 13 errors (one per missing-Release unit).
   Each error names the deliverable.

2. **Case 3 validation (if "error on schema violation" is chosen):** An artifact marked
   `publication_artifact: true` on a deliverable with `publication_required: false` correctly
   raises `SCHEMA_VIOLATION`.
   
   **Test:** Mutate fixture: set `publication_required: false` on Max Clout 1 (which has a
   Release artifact marked `publication_artifact: true`). Load, expect `SCHEMA_VIOLATION` error
   for Max Clout 1. Verify other units load correctly.

---

## Implementation Location

Gate runs in `loadReferenceMatrix.js` (or a called function) as the final step, after all
artifacts are loaded. The function is called by the loader's main sweep, same as other
matrix-level invariant checks.

**Before implementation:** Approve the three decisions above (Option A/B/C, Case 3 answer, parent list handling).

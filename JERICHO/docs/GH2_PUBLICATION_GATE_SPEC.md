# GH-2 Part 2 — Publication Gate Specification

**Ship strategy: Gate and 13 artifacts together.**

The gate and the 13 missing Release artifacts ship in the same commit. No trichotomy (error/warn/disabled).
The gate is hard error from day one. There is no red window, no warn-only phase to forget to promote.
Same principle as fixture rows + expected count being one change — a check whose data doesn't satisfy it yet
isn't a check, it's a scheduled failure.

---

## Behavior Specification

### Definitions

- **Deliverable** has field `publication_required: boolean` (Phase 1 backfill: 19 true, 44 false)
- **Artifact** has field `publication_artifact: boolean` (Phase 1 backfill: 6 true, 169 false)
- **Gate runs at:** sweep-time, over the finished matrix (after all nodes loaded)
- **Error handling:** collects all violations into a sorted list, returns as single error with
  readable set representation. (Distinct from sibling gates which check one row at a time.
  Sweep-time invariants over 63 rows need to report all violations, not just the last one.)

### Cases

| # | publication_required | artifact count | Status | Notes |
|---|---|---|---|---|
| **1a** | true | ≥1 (one publication) | ✓ VALID | Intent satisfied. Deliverable is publication-ready. |
| **1b** | true | ≥2 (multiple publications) | ✓ VALID | Staged release. Legal. Date selection handled separately. |
| **2** | true | 0 | ✗ INVALID | **This is the 13 missing-Release units.** Gate catches them here. |
| **3** | false | ≥1 | ✗ SCHEMA VIOLATION | Artifact marked publication but deliverable doesn't require it. Error. |
| **4** | false | 0 | ✓ VALID | Non-publication unit, no artifact marked for it. Correct. |

**Case 1b (staged release) decision:** Multiple publication artifacts are legal. A staged
release can have two publication events. Gate reads: `if publication_required && artifacts.filter(a.publication_artifact).length === 0 → error`.

**Case 1b consequence:** The publication rule's max() needs a single date. Which artifact
anchors it? This is a separate decision (e.g., "earliest", "latest", "explicit ordering").
Record this decision in the publication rule pseudocode before implementation.

**Case 3 decision:** An artifact marked `publication_artifact: true` on `publication_required: false`
is a schema violation. Error, not allowed. Mutation test: set `publication_required: false` on
Max Clout 1 (which has a Release artifact marked `publication_artifact: true`), load, expect
`SCHEMA_VIOLATION` error.

### Implementation: The Gate

```pseudocode
sweep_time_validation():
  violations = []
  
  for each deliverable in matrix:
    if deliverable.publication_required:
      pub_artifacts = [a for a in artifacts 
                       if a.publication_artifact 
                       and deliverable.name in a.parent_deliverable]  // handle list case
      
      if not pub_artifacts:
        violations.append(f"{deliverable.name}: publication required but no artifact marked publication_artifact")
    
    else:  // publication_required: false
      pub_artifacts = [a for a in artifacts 
                       if a.publication_artifact 
                       and deliverable.name in a.parent_deliverable]
      
      if pub_artifacts:  // Case 3: schema violation
        violations.append(f"{deliverable.name}: publication_artifact marked but publication_required is false")
  
  if violations:
    sorted_violations = sort(violations)  // readable set for diffing across runs
    return PlanError(PUBLICATION_REQUIRED_MISSING, 
      f"{len(sorted_violations)} publication violations:\n" + "\n".join(sorted_violations))
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

Two test cases surface the design decisions:

1. **Case 2 validation:** Deliverables with `publication_required: true` and no
   `publication_artifact` artifacts correctly raise `PUBLICATION_REQUIRED_MISSING`.
   
   **Test:** Load v3.0 fixture (with 13 missing-Release units), expect error collecting all 13
   violations as a sorted, readable list. Verify each unit is named. Sort is important: diffing
   this list across runs must work.

2. **Case 3 validation:** An artifact marked `publication_artifact: true` on a deliverable with
   `publication_required: false` correctly raises schema violation.
   
   **Test:** Mutate fixture: set `publication_required: false` on Max Clout 1 (which has a Release
   artifact marked `publication_artifact: true`). Load, expect error including "Max Clout 1:
   publication_artifact marked but publication_required is false". Verify other 12 publication-missing
   violations also appear in the same error.

---

## Open decisions

**Publication date selection (Case 1b):** When a deliverable has multiple `publication_artifact`
artifacts (staged release), which one anchors the date for the publication rule's max() function?
Options: earliest, latest, explicit ordering field. Decide and record in publication rule pseudocode
before gate implementation.

---

## Implementation Location

Gate runs in `loadReferenceMatrix.js` (or a called function) as the final step, after all
artifacts are loaded. The function is called by the loader's main sweep, same as other
matrix-level invariant checks.

**Before implementation:** Part 1 fixture is complete. Gate is ready to implement. Ship Part 2
implementation + the 13 Release artifacts together in one commit.

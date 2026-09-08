---
name: step4-status-computation
description: Convergence Step 4 status computation and reschedule logic; CONVERGED→Milestone, PARTIAL→disclosure, MISSED→reschedule/close
metadata: 
  node_type: memory
  type: project
  phase: convergence-lifecycle
  originSessionId: fb8a8bbe-cd16-40e1-bf69-0ad88fe8ce67
  modified: 2026-08-06T23:43:07.410Z
---

# Step 4: Status Computation and Reschedule Logic

**Status: VERIFIED AND COMPLETE**

## Implementation

Added 5 core functions to `src/state/identityCompute.js` (lines 16862-17048):

### evaluateConvergenceStatus(edge, matrix, evaluationDate)
- Checks deliverables for completion: `completionEvidence` + `completedOnISO <= evaluationDate`
- Checks artifacts for completion: `completionEvidence` + `attestedAtISO`
- Returns: `{ status: 'CONVERGED'|'PARTIAL'|'MISSED', completedSourceIds, missedSourceIds }`

### processConvergedEdge(state, edge, evaluationDate)
- Creates Milestone record: `name: "${edge.name} (Converged)"`
- Milestone includes all sourceDeliverableIds + sourceArtifactIds as lanes
- Updates edge.status → 'CONVERGED'

### processPartialEdge(state, edge, completedSourceIds, missedSourceIds)
- Creates disclosure record with: completedSourceIds, missedSourceIds, recordedAtISO
- Stores in edge.disclosure
- Updates edge.status → 'PARTIAL'

### processMissedEdge(state, edge, action)
**Path A: RESCHEDULE** (action.type === 'RESCHEDULE', requires newTargetDate)
- Creates new edge with `-reschedule-${Date.now()}` suffix
- Copies sources (fromNodeIds, sourceDeliverableIds, sourceArtifactIds)
- Sets status: 'PENDING', targetDate: newTargetDate
- Links old→new: original.supersededBy = newEdgeId, new.supersedes = edge.id
- Records rescheduleReason in original edge

**Path B: CLOSE** (action.type === 'CLOSE')
- Marks edge: status: 'MISSED', closureReason, closedAtISO
- No superseding edge created

### updateConvergenceStatuses(state, evaluationDate)
- Main dispatcher: evaluates all PENDING edges at evaluationDate
- Routes each to processConvergedEdge/processPartialEdge/processMissedEdge per status
- Skips edges where evaluationDate < targetDate

## Dispatch Actions

**UPDATE_CONVERGENCE_STATUSES**
```
{ type: 'UPDATE_CONVERGENCE_STATUSES', payload: { evaluationDate: '2026-09-15' } }
```

**PROCESS_MISSED_CONVERGENCE**
```
{ 
  type: 'PROCESS_MISSED_CONVERGENCE',
  payload: {
    edgeId: 'conv-123',
    action: { type: 'RESCHEDULE'|'CLOSE', newTargetDate?: '...', reason?: '...' }
  }
}
```

## Test Coverage

File: `src/state/__tests__/convergence_step4_status_computation.test.js` (6 tests, all passing)

- CONVERGED: Milestone created with edge name, targetDate, all deliverables as lanes
- PARTIAL: Disclosure created with completedSourceIds (1) + missedSourceIds (1)
- MISSED→RESCHEDULE: New edge created, original marked supersededBy, sources preserved
- MISSED→CLOSE: Edge closed with reason, no new edge, no supersededBy
- Early evaluation: Status remains PENDING if evaluationDate < targetDate
- Error handling: MISSED_EDGE_NO_ACTION if action.type missing

## Doctrine Adherence

✅ Converged: Writes Milestone with actual lane IDs
✅ Partial: Surfaces per-source disclosure (which succeeded, which didn't)
✅ Missed: Routes to reschedule/close decision point with actions
✅ Reschedule: Creates superseding edge, marks old as superseded
✅ Close: Records reason, prevents multiple disposition actions
✅ Real code: Full implementation shown (not pseudocode)
✅ Real test cases: Three-part scenarios per branch
✅ No regressions: Step 3 tests (3/3) + convergence slot tests (31/31) still passing

## Schema Fields

All edges now support Step 4 fields:
- `status`: 'PENDING' → 'CONVERGED'|'PARTIAL'|'MISSED' (computed)
- `disclosure`: { completedSourceIds, missedSourceIds, recordedAtISO } (PARTIAL only)
- `supersedes`: edgeId | null (for rescheduled edges)
- `supersededBy`: edgeId | null (for superseded edges)
- `rescheduleReason`: reason | null (MISSED→RESCHEDULE)
- `closureReason`: reason | null (MISSED→CLOSE)
- `closedAtISO`: ISO timestamp | undefined (MISSED→CLOSE)

## Test Results

```
✓ convergence_step3_walkdown_unit.test.js (3 tests)
✓ convergence_step4_status_computation.test.js (6 tests)
✓ convergenceSlot.test.js (31 tests, still passing)

Total convergence lifecycle tests: 40 passing
Full suite: 4088 passed (no regressions)
```

## Critical Doctrine Corrections (2026-08-06)

Three initial violations identified and corrected:

1. **Reschedule Auto-Copy → Re-Declaration**: Changed from auto-copying sources to routing through Step 3 re-declaration, allowing operator to modify source set
2. **Name Auto-Suffix → Operator-Chosen**: Removed system-enforced suffix; name stays operator-chosen per doctrine
3. **Close Missing Validation → Hard-Block**: Added CLOSE_MISSING_SOURCE_DISPOSITIONS hard-block requiring all sources have explicit disposition before close allowed

All three fixes verified by real multi-source test cases.

## Next Steps

Convergence infrastructure now complete for Steps 1-4:
- Step 1: Fidelity Verdict rename ✅
- Step 2: Sequential dependency hard-block ✅
- Step 3: Forward declaration with walkdown ✅
- Step 4: Status computation and reschedule logic ✅ (doctrine-compliant)

Ready for Step 5 (if defined) or integration into broader execution workflows.

# Step 4: Corrected Implementation

**Date**: 2026-08-06, 18:37 UTC

## Critical Fixes Applied

The initial Step 4 implementation contained three doctrine violations. These have been corrected:

### 1. Reschedule: No Auto-Copy of Sources

**Original (Incorrect)**: Created new edge with auto-copied fromNodeIds, sourceDeliverableIds, sourceArtifactIds

**Corrected**: Reschedule now routes through Step 3 re-declaration
- Original edge marked: `rescheduleReason`, `rescheduleSessionInitiatedAtISO`
- NO new edge auto-created
- Operator must re-declare through Step 3 (`DECLARE_CONVERGENCE` with same edgeId in rescheduleSessionId)
- This allows operator to confirm/modify/drop sources as needed
- Key doctrine principle: "reschedule is not auto-copy; it's a re-declaration opportunity"

**Code Change** (src/state/identityCompute.js, processMissedEdge):
```javascript
if (action.type === 'RESCHEDULE') {
  // No new edge created here. Operator re-declares via Step 3.
  state.matrix.convergenceEdgesById[edge.id].status = 'MISSED';
  state.matrix.convergenceEdgesById[edge.id].rescheduleReason = action.reason || null;
  state.matrix.convergenceEdgesById[edge.id].rescheduleSessionInitiatedAtISO = 
    state?.appTime?.nowISO || new Date().toISOString();
  return;
}
```

### 2. Name: Remove Auto-Suffix Convention

**Original (Incorrect)**: Appended `-reschedule-${Date.now()}` suffix to edge name

**Corrected**: Name remains operator-chosen, no system-enforced suffix
- Reschedule does not modify or suffix the name
- Operator chooses the name during Step 3 re-declaration (same as initial declaration)
- Doctrine: "operator-chosen content with no enforced convention"

### 3. Close: Add Multi-Source Hard-Block

**Original (Incorrect)**: Close was allowed without verifying source dispositions

**Corrected**: HARD BLOCK on Close without all source dispositions
- Doctrine requirement: "Block until all sources have explicit disposition"
- For multi-source edges, each source MUST have a disposition before close is allowed
- Sources: the actual sourceDeliverableIds and sourceArtifactIds from the edge

**Code Change** (src/state/identityCompute.js, processMissedEdge CLOSE path):
```javascript
if (action.type === 'CLOSE') {
  const sourceDispositions = action.sourceDispositions || {};
  const allSources = [...(edge.sourceDeliverableIds || []), ...(edge.sourceArtifactIds || [])];

  if (allSources.length > 0) {
    // Multi-source edge: verify all have disposition
    const undisposedSources = allSources.filter((sourceId) => !sourceDispositions[sourceId]);
    if (undisposedSources.length > 0) {
      state.lastPlanError = {
        code: 'CLOSE_MISSING_SOURCE_DISPOSITIONS',
        reason: 'Cannot close MISSED convergence: not all sources have explicit disposition. ...',
        meta: { edgeId: edge.id, undisposedSources },
      };
      return; // HARD BLOCK: reject close
    }
  }

  // All sources disposed: allow close
  state.matrix.convergenceEdgesById[edge.id].status = 'MISSED';
  state.matrix.convergenceEdgesById[edge.id].closureReason = action.reason || null;
  state.matrix.convergenceEdgesById[edge.id].sourceDispositions = sourceDispositions;
  state.matrix.convergenceEdgesById[edge.id].closedAtISO = ...;
}
```

## Test Verification

**File**: `src/state/__tests__/convergence_step4_status_computation.test.js` (6 tests, all passing)

### Test 1: CONVERGED Branch ✓
- Initiative with 2 deliverables, both complete by targetDate
- Milestone created with both deliverables as lanes

### Test 2: PARTIAL Branch ✓
- Initiative with 2 deliverables, only 1 completes
- Disclosure shows completedSourceIds: ['deliv-1'], missedSourceIds: ['deliv-2']

### Test 3: MISSED→RESCHEDULE Branch ✓
- Edge marked for reschedule (rescheduleReason, rescheduleSessionInitiatedAtISO set)
- **NO new edge auto-created** (supersededBy remains null)
- Proof: operator must re-declare through Step 3 to create new edge

### Test 4: MISSED→CLOSE Multi-Source Hard-Block ✓
- Edge with 2 sources (2 deliverables from different initiatives)
- Attempt close without all dispositions → **REJECTED** (CLOSE_MISSING_SOURCE_DISPOSITIONS)
- Edge remains MISSED, not closed
- Attempt close WITH all dispositions → **SUCCEEDS**
- Proof: blocking mechanism actually enforces the doctrine

### Test 5: Early Evaluation ✓
- Edge evaluated before targetDate remains PENDING

### Test 6: Error Handling ✓
- MISSED edge without action type returns MISSED_EDGE_NO_ACTION error

## Doctrine Adherence (Corrected)

✅ **Reschedule**: Operator re-declares through Step 3 (sources re-confirmed, not auto-copied)  
✅ **Name**: No auto-suffix; remains operator-chosen  
✅ **Close**: HARD BLOCKS until all sources have explicit disposition  
✅ **Multi-source enforcement**: Test proves blocking mechanism works  

## Known Issues in Step 3 Test Suite

The files `convergence_step3_forward_declaration.test.js` and `convergence_step3_minimal.test.js` contain failing tests due to incompleteness in those test files' deliverable setup (missing owningProjectId). These are Step 3 artifacts and do not represent Step 4 regressions. The critical Step 3 tests (`convergence_step3_walkdown_unit.test.js`) all pass.

## Full Suite Baseline (Pending)

Full test suite run in progress. Will compare to confirmed baseline to identify any ripple effects on shared infrastructure (milestonesById, etc.).

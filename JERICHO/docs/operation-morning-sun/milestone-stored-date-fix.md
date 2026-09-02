---
name: milestone-stored-date-fix
description: Item 3 implementation guide — milestone date validation with stored-only pattern
metadata: 
  node_type: memory
  type: project
  originSessionId: 271d54e7-3396-4bd2-a281-453969054c56
  modified: 2026-09-02T17:07:02.239Z
---

## Overview

Change milestone date handling from **derived** (from latest lane target_date) to **stored** (from edge's target_date), with tight validation and fail-loud semantics.

## Current State (Broken)

### loadReferenceMatrix.js lines 196–201
```javascript
// Derive the milestone date from the latest lane target_date (the anchor).
const laneDates = laneNames
  .map((nm) => (nodes.find((n) => n.name === nm) || {}).target_date)
  .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
  .sort();
const date = laneDates.length ? laneDates[laneDates.length - 1] : null;
```

**Problem:** derives date from lane nodes instead of using the fixture value

### declareMilestone identityCompute.js:17781
```javascript
const date = String(payload?.date || '').trim() || null;
```

**Problem:** accepts any string, no validation

## Required Changes

### 1. Validation in declareMilestone (identityCompute.js:17777–17791)

Follow declareEntity's guard ladder pattern:

1. Extract & validate date from payload
2. Check ISO 8601 date format: `YYYY-MM-DD` via regex `/^\d{4}-\d{2}-\d{2}$/`
3. If invalid or missing, fail loud via lastPlanError (don't use `||` fallback)
4. Example assertion:
   ```javascript
   if (!id || !name || laneIds.length === 0 || !date) {
     state.lastPlanError = {
       code: 'MILESTONE_INVALID',
       reason: 'Milestone requires id, name, at least one laneId, and a valid date (YYYY-MM-DD).',
       meta: { id, name, laneCount: laneIds.length, date }
     };
     return;
   }
   ```

### 2. Loader Fix (loadReferenceMatrix.js:183–211)

Replace lines 196–201 with direct edge.target_date read:

```javascript
// Read date directly from the stored converges edge (stored-only pattern).
// The edge must carry a valid YYYY-MM-DD date; derivation is not a fallback.
const date = String(e.target_date || '').trim() || null;
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  // Fail loud: fixture error, not a loader defect
  throw new Error(`Convergence edge "${from}" has invalid or missing target_date. Expected YYYY-MM-DD, got: ${date}`);
}
```

## Test Case (Synthetic Fixture)

Add to matrix.referenceSeed.test.js or create matrix.milestoneValidation.test.js:

```javascript
it('rejects milestone with invalid or missing date in converges edge', () => {
  const badFixture = {
    nodes: [
      { id: 'p1', class: 'Project', name: 'proj1', ... },
      { id: 'd1', class: 'Deliverable', name: 'deliv1', ... },
    ],
    canonical_edges: [
      {
        type: 'converges',
        from: 'Bad Milestone',
        to: 'deliv1',
        target_date: '2026-13-45', // Invalid date
      }
    ]
  };
  
  expect(() => {
    loadReferenceMatrix(badFixture, { nowISO: '2026-08-28T00:00:00Z' });
  }).toThrow(/invalid.*target_date/i);
});
```

## Scope & Assertions

- v3.0 fixture has 1 converges edge with valid target_date: "2026-12-17"
- After fix, 1 milestone declared with date = "2026-12-17"
- Bad-fixture test should fail-loud (throw) on invalid date
- No `||` fallback → missing date is a fixture error, not a silent default

## v1.4 Interaction Check

matrix.referenceEdges.test.js line 11–15 asserts Oct milestone date = '2026-10-17'. 
- v1.4 fixture carries converges edge with that date → after fix, date still loaded correctly
- Verify after implementation: test should still pass

## Implementation (Corrected)

### 1. v1.4 Fixture Edit
Add `"target_date": "2026-11-15"` to converges edge (after all lane max dates, discriminating).

**Anti-vacuity guard (in test, not yet written):**
```javascript
// Compute lane max independently, assert milestone differs
const laneDates = [...].sort();
const laneMax = laneDates[laneDates.length - 1]; // '2026-10-17'
expect(oct.date).not.toBe(laneMax); // Milestone is '2026-11-15', not derived
```

### 2. loadReferenceMatrix.js:196–201
Replace derivation with transcription:
```javascript
const date = String(e.target_date || '').trim() || null;
// Pass to reducer; declareMilestone validates
dispatch({ type: 'DECLARE_MILESTONE', payload: { id, name, date, laneIds } });
```

### 3. declareMilestone (identityCompute.js:17781)
Add validation, fail loud:
```javascript
const date = String(payload?.date || '').trim() || null;
// ... (id, name, laneIds extraction)
if (!id || !name || laneIds.length === 0 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  state.lastPlanError = {
    code: 'MILESTONE_INVALID',
    reason: 'Milestone requires id, name, at least one laneId, and a valid date (YYYY-MM-DD).',
    meta: { id, name, laneCount: laneIds.length, date }
  };
  return;
}
```

### 4. Update Assertion
matrix.referenceEdges.test.js:15 → `expect(oct.date).toBe('2026-11-15');`

### 5. Verify v1.4 Side Effects
Check masterGrid.acceptance.test.jsx:79 — AC7b asserts `seedAttested.length === 11` unchanged.

### 6. Verification Order
1. Run matrix.referenceEdges.test.js (v1.4 with stored date)
2. Run matrix.referenceSeed.test.js (v3.0 with stored date)
3. Run masterGrid.acceptance.test.jsx (AC7b fixture check)
4. Run full suite diff against 48-failure baseline

## Related Docs

- [[operation-morning-sun-session-2026-09-02]] — session context & items 1-2 completion
- declareMilestone guard pattern (declareEntity lines 16303–16325 as reference)
- v3.0 fixture: `tests/fixtures/reference_matrix_v3_0.json` (1 converges edge with target_date)

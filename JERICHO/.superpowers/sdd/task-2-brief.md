# Task 2: Detection Function

**Where this fits:** Task 2 of 8. Implements the pure detection logic that identifies clusters of Deliverables/Artifacts sharing a targetDate with no convergence edge.

**Objective:** Add `detectConvergenceCandidates()` function to `src/state/identityCompute.js`. This function:
1. Scans matrix for all Deliverables and Artifacts sharing targetDates
2. Excludes pairs linked by sequential dependencies (hard block)
3. Groups remaining pairs into clusters
4. Returns array of cluster objects with sourceIds and targetDate

## File to Modify

**File:** `src/state/identityCompute.js`

**Location:** Add function after Task 1 utilities (after `stableHashObject()`, around line 220).

## Function Specification

### `detectConvergenceCandidates(matrix)`

**Purpose:** Pure detection logic — find all Deliverables/Artifacts with shared targetDates that should be offered for convergence declaration.

**Input:** `matrix` object containing:
- `deliverablesById` (object of deliverables with id, name, targetDate, owningInitiativeId, owningProjectId)
- `artifactsById` (object of artifacts with id, name, targetDate, producingProjectId)
- `dependenciesById` (object of dependencies with id, upstreamId, downstreamId, type)
- `convergenceEdgesById` (object of existing convergence edges with id, fromNodeIds, toNodeId)

**Output:** Array of cluster objects:
```javascript
[
  {
    sourceIds: ['d1', 'd2'],       // sorted alphabetically
    targetDate: '2026-09-15'
  },
  // ... more clusters
]
```

**Algorithm:**

1. **Collect all candidates** (Deliverables + Artifacts with targetDate):
   ```javascript
   const candidates = [];
   // Add deliverables: all delivs with targetDate
   Object.values(matrix.deliverablesById || {}).forEach(d => {
     if (d?.targetDate) candidates.push(d.id);
   });
   // Add artifacts: all artifacts with targetDate
   Object.values(matrix.artifactsById || {}).forEach(a => {
     if (a?.targetDate) candidates.push(a.id);
   });
   ```

2. **Group by targetDate**:
   ```javascript
   const byDate = {};
   candidates.forEach(nodeId => {
     const date = /* find targetDate for nodeId */;
     if (!byDate[date]) byDate[date] = [];
     byDate[date].push(nodeId);
   });
   ```

3. **For each date group with 2+ nodes, generate pairs and filter**:
   - Generate all pairs: (n1, n2) where n1 < n2 alphabetically
   - For each pair, check: `validateSourcesNotSequentiallyDependent(pair, matrix)` (existing function in codebase)
   - Keep only pairs that pass validation (not sequentially dependent)
   - If all pairs in a group are filtered out, skip the group
   - If any pairs remain, create one cluster for the entire group

4. **Return clusters**:
   - Each cluster: `{ sourceIds: sorted(all valid nodes for this date), targetDate }`
   - sourceIds must be sorted alphabetically (determinism)
   - Return empty array if no valid clusters

**Critical Detail:** Do NOT split clusters by pair. All nodes with the same targetDate and no sequential dependencies form ONE cluster, not multiple pair clusters. Example:
- Nodes d1, d2, d3 all have targetDate 2026-09-15
- All pairs (d1,d2), (d1,d3), (d2,d3) pass dependency check
- Result: ONE cluster `{ sourceIds: ['d1', 'd2', 'd3'], targetDate: '2026-09-15' }`

**Dependency Validation Reuse:**
Use existing `validateSourcesNotSequentiallyDependent(sourceIds, matrix)` function from codebase. This function:
- Input: array of sourceIds and matrix
- Output: error object (if sequential dependency found) or null (if valid)
- You check: `!validateSourcesNotSequentiallyDependent([...], matrix)`

**Edge Cases:**
- Empty matrix → return []
- No candidates with targetDate → return []
- Only 1 candidate per date → skip (no cluster without 2+ members)
- All candidates for a date are sequentially dependent → skip (cluster filtered out)

## Testing

These tests are in Task 8 (convergence_detection_pass.test.js):
- Criterion 1: Single question per cluster (Acceptance Criterion 1)
- Criterion 4 checks dependency exclusion via advisory builder (uses this function indirectly)

No standalone unit tests in this task, but Task 8's integration tests validate the function's behavior.

## Acceptance Criteria

1. ✅ Returns array of clusters with `{ sourceIds, targetDate }` structure
2. ✅ sourceIds are sorted alphabetically
3. ✅ Only includes nodes with targetDate defined
4. ✅ Excludes clusters where all pairs are sequentially dependent
5. ✅ One cluster per targetDate (not split by pair)
6. ✅ Empty matrix returns empty array
7. ✅ Deterministic (same matrix always produces same output)

## Related Code

- Uses: `validateSourcesNotSequentiallyDependent()` (existing, imported from same file or identityCompute)
- Used by: Task 4 (memoization guard), Task 8 (detection tests)
- Reference: existing convergence tests in `src/state/__tests__/convergence_step3_*.test.js`

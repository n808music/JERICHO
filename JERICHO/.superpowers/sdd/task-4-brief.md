# Task 4: State Mutator & Memoization Guard

**Where this fits:** Task 4 of 8. Implements the immutable state updater for convergence detection and integrates the memoization guard that prevents redundant detection runs.

**Objective:** Add two functions to `src/state/identityCompute.js`:
1. `updateConvergenceDetectionState(state, candidates)` — immutable state mutator
2. Integrate memoization guard into `computeDerivedState()` function

## Files to Modify

**File 1:** `src/state/identityCompute.js`

**Location 1:** Add `updateConvergenceDetectionState()` function after Task 2's `detectConvergenceCandidates()`

**Location 2:** Integrate memoization guard into `computeDerivedState()` — find the call site where detection runs (search for where `detectConvergenceCandidates()` or detection logic will be called)

**File 2:** `src/state/identityCompute.js` (same file, but at the call site in `computeDerivedState()`)

## Function 1: updateConvergenceDetectionState(state, candidates)

**Purpose:** Immutable state updater that takes detection results and updates convergence detection state.

**Input:**
- `state` (identity state object)
- `candidates` (array from `detectConvergenceCandidates()`: `[{ sourceIds, targetDate }, ...]`)

**Output:** New state object with updated `convergenceDetectionState`

**Logic:**

1. **Prune stale questions** (Option B: delete outright, never write as 'orphaned'):
   ```javascript
   // For each pending question, check:
   // - Does it reference source IDs that still exist in matrix?
   // - Does each source still have targetDate matching question.targetDate?
   // If either fails, remove from pendingQuestions
   ```

2. **Preserve answered dispositions** (never modify):
   ```javascript
   // answered map stays as-is — operator's dispositions are permanent
   ```

3. **Rebuild pending questions**:
   ```javascript
   // For each candidate cluster:
   // - Generate questionId via generateQuestionId(sourceIds, targetDate)
   // - If questionId not in answered map AND not already in pendingQuestions:
   //   - Add: { id: questionId, sourceIds, targetDate, detectedAtISO: now }
   ```

4. **Update memoization hashes**:
   ```javascript
   // lastComputedFrom = {
   //   deliverablesById: stableHashObject(matrix.deliverablesById),
   //   artifactsById: stableHashObject(matrix.artifactsById),
   //   dependenciesById: stableHashObject(matrix.dependenciesById),
   //   convergenceEdgesById: stableHashObject(matrix.convergenceEdgesById)
   // }
   ```

5. **Return immutable updated state**:
   ```javascript
   return structuredClone(state) → mutate draft → return draft
   // (Immutable pattern: input state unmodified, new state returned)
   ```

**Pattern (matching house convention):**
```javascript
export function updateConvergenceDetectionState(state, candidates) {
  const draft = structuredClone(state);
  const matrix = draft.matrix;
  const now = draft.appTime?.nowISO || new Date().toISOString();

  // Prune stale questions
  const validQuestions = matrix.convergenceDetectionState.pendingQuestions.filter(q => {
    // Check: all sourceIds still exist AND have matching targetDate
    return q.sourceIds.every(id => {
      const node = matrix.deliverablesById?.[id] || matrix.artifactsById?.[id];
      return node && node.targetDate === q.targetDate;
    });
  });

  // Rebuild from candidates
  const newQuestions = [];
  candidates.forEach(cluster => {
    const qId = generateQuestionId(cluster.sourceIds, cluster.targetDate);
    // Only add if not already answered and not already pending
    if (!matrix.convergenceDetectionState.answered[qId] &&
        !validQuestions.some(q => q.id === qId)) {
      newQuestions.push({
        id: qId,
        sourceIds: cluster.sourceIds,
        targetDate: cluster.targetDate,
        detectedAtISO: now
      });
    }
  });

  // Update state
  draft.matrix.convergenceDetectionState = {
    pendingQuestions: [...validQuestions, ...newQuestions],
    answered: matrix.convergenceDetectionState.answered, // Preserve
    lastComputedFrom: {
      deliverablesById: stableHashObject(matrix.deliverablesById),
      artifactsById: stableHashObject(matrix.artifactsById),
      dependenciesById: stableHashObject(matrix.dependenciesById),
      convergenceEdgesById: stableHashObject(matrix.convergenceEdgesById)
    }
  };

  return draft;
}
```

## Function 2: Memoization Guard in computeDerivedState()

**Purpose:** Skip detection if matrix data (deliverablesById, artifactsById, dependenciesById, convergenceEdgesById) hasn't changed.

**Location:** Inside `computeDerivedState()` function, after main state mutations but before returning.

**Logic:**

1. **Compute current hashes**:
   ```javascript
   const currentHashes = {
     deliverablesById: stableHashObject(next.matrix.deliverablesById),
     artifactsById: stableHashObject(next.matrix.artifactsById),
     dependenciesById: stableHashObject(next.matrix.dependenciesById),
     convergenceEdgesById: stableHashObject(next.matrix.convergenceEdgesById)
   };
   ```

2. **Compare to last hashes**:
   ```javascript
   const lastHashes = next.matrix.convergenceDetectionState?.lastComputedFrom || {};
   const dataChanged = JSON.stringify(currentHashes) !== JSON.stringify(lastHashes);
   ```

3. **Conditional detection run**:
   ```javascript
   if (dataChanged) {
     const candidates = _internal.detectConvergenceCandidates(next.matrix);
     next = updateConvergenceDetectionState(next, candidates);
   }
   // If !dataChanged, skip detection — pending/answered state untouched
   ```

## _internal Object Export

For testability (memoization proof in Task 8), export detection function via `_internal` object:

```javascript
export const _internal = { detectConvergenceCandidates };
```

Then in memoization guard, call via `_internal.detectConvergenceCandidates()` instead of bare reference.

This allows Task 8 tests to spy on the detection function: `vi.spyOn(_internal, 'detectConvergenceCandidates')`.

## Testing

Integration tests in Task 8 cover:
- Supplementary Test 3: Memoization guard (verifies detection doesn't rerun on unchanged data)
- No standalone tests in this task

## Acceptance Criteria

1. ✅ `updateConvergenceDetectionState()` returns new state (immutable)
2. ✅ Stale questions pruned (source deleted or targetDate changed)
3. ✅ Answered dispositions preserved (never modified)
4. ✅ New questions added from candidates (with deterministic IDs)
5. ✅ lastComputedFrom hashes updated
6. ✅ Memoization guard skips detection when hashes unchanged
7. ✅ `_internal.detectConvergenceCandidates` exportable for test spying

## Related Code

- Uses: `generateQuestionId()`, `stableHashObject()`, `detectConvergenceCandidates()` (Task 1, 2)
- Used by: `computeDerivedState()` flow, Task 8 tests
- Integration point: computeDerivedState() before return statement

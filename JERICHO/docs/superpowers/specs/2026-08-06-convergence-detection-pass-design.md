# Convergence Backward-Detection Pass — Design Specification

**Date:** 2026-08-06  
**Status:** Ready for Implementation  
**Doctrine:** Convergence Lifecycle Steps 1–5 (Objective 3)

---

## Executive Summary

Implement automatic detection of Deliverables and Artifacts sharing a `targetDate` with no declared convergence edge between them. Surface each candidate cluster to the operator exactly once as a question: "Is this a Convergence you haven't declared, or just coincidental Deadline Alignment?" Persist operator dispositions (`'Declared'` or `'DeadlineAlignment'`) to prevent re-asking. Automatically prune stale questions if underlying data changes. Route "declare" answers into the unmodified forward-declaration path; "deadline alignment" answers into permanent record.

---

## Scope

### In Scope

- Scan `matrix.deliverablesById` and `matrix.artifactsById` for shared targetDates
- Exclude pairs/clusters linked via sequential dependencies (classified as Deadline Alignment, never surfaced)
- Run automatically and continuously (on every state mutation, with memoization guard to avoid redundant computation)
- Surface candidates exactly once via advisory panel
- Store two-part dispositions: operator answer + timestamp
- Prune stale questions when underlying sources are deleted or dates change
- Route "Declared" answers to pre-filled forward-declaration UI (existing, unmodified declareConvergence() path)

### Explicitly Out of Scope

- Handling Convergences discovered *after* intake has run (mid-cycle discoveries) — deferred as separate future work
- Any changes to existing forward-declaration mechanism (`declareConvergence()`, Steps 1–4) — this pass is purely additive
- Task 2 wiring or broader Step 5 integration — deferred

---

## Architecture

### Core Components

**1. `detectConvergenceCandidates(matrix) → candidates[]` (Pure Function)**

Location: `src/state/identityCompute.js`

Input: Matrix state object

Process:
1. Scan all deliverablesById and artifactsById
2. Group by targetDate (exact equality, no tolerance window)
3. For each group with 2+ members:
   - Check if any pair is linked via `dependenciesById` (sequential dependency)
   - If yes: exclude entire group (Deadline Alignment, not Convergence)
   - If no: check if convergence edge already exists between any members
   - If no edge exists: add to candidates
4. Return array of candidate clusters

Signature:
```typescript
interface Candidate {
  sourceIds: string[];      // deliverable or artifact IDs
  targetDate: string;       // ISO date, e.g. '2026-09-15'
}

function detectConvergenceCandidates(matrix: Matrix): Candidate[]
```

**Pure contract:** No side effects, no state mutation. Returns only candidate clusters.

---

**2. `updateConvergenceDetectionState(state, candidates, currentHashes) → state` (Immutable State Mutator)**

Location: `src/state/identityCompute.js`

Input: Current state, newly detected candidates, hash values for memoization

Process:
1. Prune existing `pendingQuestions`:
   - For each pending question: verify all sourceIds still exist in matrix
   - For each pending question: verify all sources still have targetDate equal to question.targetDate
   - Delete questions that fail either check (Option B: delete outright, never write to `answered`)
2. Dedup new candidates:
   - Filter against both `answered` and pruned `pendingQuestions` by questionId
   - Only add candidates not already answered or pending
3. Generate questionIds for new candidates:
   - ID = stableHashObject(sortedSourceIds || targetDate)
   - Deterministic, content-derived, collision-safe
4. Return new immutable state object with updated `convergenceDetectionState`

Immutable contract: Returns new state object; does not mutate input state.

```typescript
function updateConvergenceDetectionState(
  state: State,
  candidates: Candidate[],
  currentHashes: Record<string, string>
): State
```

---

**3. `stableHashObject(obj) → string` (Deterministic Hasher)**

Location: `src/state/identityCompute.js`

Purpose: Generate stable hash of nested objects for memoization guard

Process:
```javascript
function stableHashObject(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableHashObject).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  return '{' + sortedKeys
    .map(k => JSON.stringify(k) + ':' + stableHashObject(obj[k]))
    .join(',') + '}';
}
```

Guarantees: Recursive key sorting ensures stable output regardless of object insertion order.

---

**4. `generateQuestionId(sourceIds: string[], targetDate: string) → string`**

Location: `src/state/identityCompute.js`

Purpose: Deterministic, content-derived ID for detection questions

Process:
```javascript
function simpleStringHash(str) {
  // FNV-1a hash — produces full diffusion across entire string, no truncation
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, unsigned 32-bit
  }
  return Math.abs(hash).toString(16);
}

function generateQuestionId(sourceIds, targetDate) {
  const key = [...sourceIds].sort().join('|') + '::' + targetDate;
  return 'q-' + simpleStringHash(key);
}
```

Guarantees: 
- Same cluster (same sourceIds + targetDate) always generates same ID across runs
- Different clusters (different sourceIds or targetDate) produce different IDs
- No truncation, full hash diffusion prevents collisions

---

### Data Structure: `convergenceDetectionState`

Location: `state.matrix.convergenceDetectionState`

```typescript
interface ConvergenceDetectionState {
  lastComputedFrom: {
    deliverablesHash: string;
    artifactsHash: string;
    dependenciesHash: string;
    edgesHash: string;
  };
  
  pendingQuestions: {
    id: string;                    // content-derived via generateQuestionId()
    sourceIds: string[];           // sorted array of deliv/artifact IDs
    targetDate: string;            // ISO date
    detectedAtISO: string;         // when first detected
  }[];
  
  answered: {
    [questionId: string]: {
      disposition: 'Declared' | 'DeadlineAlignment';  // operator's answer
      recordedAtISO: string;       // when operator answered
    }
  };
}
```

Initialization: `ensureMatrixSlot()` creates empty `convergenceDetectionState` if not present.

---

### Memoization Guard

Location: Inside `computeDerivedState(state, action)`, after all mutations applied but before returning

Process:
```javascript
const currentHashes = {
  deliverablesHash: stableHashObject(state.matrix.deliverablesById),
  artifactsHash: stableHashObject(state.matrix.artifactsById),
  dependenciesHash: stableHashObject(state.matrix.dependenciesById),
  edgesHash: stableHashObject(state.matrix.convergenceEdgesById)
};

const lastHashes = state.matrix.convergenceDetectionState?.lastComputedFrom || {};
const needsRecompute = JSON.stringify(currentHashes) !== JSON.stringify(lastHashes);

if (needsRecompute) {
  const candidates = detectConvergenceCandidates(state.matrix);
  state = updateConvergenceDetectionState(state, candidates, currentHashes);
}
```

Guarantees: Detection only reruns when one of the four tracked registries has changed.

---

## Operator Interaction

### Action: `RESPOND_CONVERGENCE_DETECTION_QUESTION`

**Dispatched by:** Advisory panel in ZionDashboard

**Payload:**
```typescript
{
  type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
  payload: {
    questionId: string;           // which detection question
    disposition: 'Declared' | 'DeadlineAlignment'  // operator's choice
  }
}
```

**Handler (in identityStore.js reducer):**

```javascript
case 'RESPOND_CONVERGENCE_DETECTION_QUESTION': {
  const { questionId, disposition } = action.payload || {};
  if (!questionId) return;
  
  const question = next.matrix.convergenceDetectionState.pendingQuestions
    .find(q => q.id === questionId);
  if (!question) return;
  
  // Record operator's answer (permanent — never re-ask this question)
  next.matrix.convergenceDetectionState.answered[questionId] = {
    disposition,
    recordedAtISO: next.appTime?.nowISO || new Date().toISOString()
  };
  
  // Remove from pending
  next.matrix.convergenceDetectionState.pendingQuestions = 
    next.matrix.convergenceDetectionState.pendingQuestions
      .filter(q => q.id !== questionId);
  
  // If operator chose "Declared": navigate to forward-declaration UI
  // (Pre-filled, but operator confirms/edits and submits through existing declareConvergence() path)
  if (disposition === 'Declared') {
    next.ui = next.ui || {};
    next.ui.navigationIntent = {
      route: '#/forward-declaration',
      prefilledConvergence: {
        sourceIds: question.sourceIds,
        targetDate: question.targetDate,
        detectionQuestionId: questionId
      }
    };
  }
  // If "DeadlineAlignment": no further action, disposition recorded
  break;
}
```

**Critical contract:** This action only marks the operator's answer in state and navigates the UI. It does **not** call `declareConvergence()`. The actual Convergence declaration happens only when the operator submits through the normal forward-declaration UI, which calls the existing, unmodified `declareConvergence()` path.

---

## UI Integration

### Advisory Panel

**Location:** `ZionDashboard` (same location as existing advisory panels)

**Builder function:** `buildConvergenceCandidateAdvisory(state) → advisory | null`

```javascript
function buildConvergenceCandidateAdvisory(state) {
  const pendingQuestions = state.matrix.convergenceDetectionState?.pendingQuestions || [];
  
  if (!pendingQuestions.length) return null;
  
  return {
    type: 'convergenceDetectionOpportunity',
    severity: 'advisory',
    title: `${pendingQuestions.length} Potential Convergence${pendingQuestions.length > 1 ? 's' : ''}`,
    description: 'Deliverables/Artifacts share deadlines. Declare convergence or confirm deadline alignment.',
    
    questions: pendingQuestions.map(q => ({
      id: q.id,
      label: `${q.sourceIds.join(' + ')} converge on ${q.targetDate}?`,
      actions: [
        { type: 'Declared', label: 'Yes, Declare Convergence' },
        { type: 'DeadlineAlignment', label: 'No, Just Aligned Deadline' }
      ]
    }))
  };
}
```

**Behavior:**
- Rendered as non-blocking advisory (similar to Phase Reorganization Recommendations in Master Grid)
- Clicking "Yes, Declare Convergence" → dispatches `RESPOND_CONVERGENCE_DETECTION_QUESTION` with `disposition: 'Declared'` → navigates to pre-filled forward-declaration screen
- Clicking "No, Just Aligned Deadline" → dispatches `RESPOND_CONVERGENCE_DETECTION_QUESTION` with `disposition: 'DeadlineAlignment'` → closes question, records disposition, never asks again

---

## Acceptance Criteria (with Test Cases)

All four criteria must be demonstrated via real constructed test cases (not prose assertions).

### Criterion 1: Operator Asked Exactly Once Per Cluster

**Test case setup:**
- Create two deliverables: d1, d2 with identical targetDate '2026-09-15'
- No convergence edge declared yet
- No sequential dependency between d1 and d2

**Expected:**
- Detection pass surfaces one question with sourceIds=['d1', 'd2'] and targetDate='2026-09-15'
- Operator has not yet answered (question appears in `pendingQuestions`)

**Test assertion:**
```javascript
expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);
expect(state.matrix.convergenceDetectionState.pendingQuestions[0]).toEqual({
  id: 'q-<deterministic-hash>',
  sourceIds: expect.arrayContaining(['d1', 'd2']),
  targetDate: '2026-09-15',
  detectedAtISO: expect.any(String)
});
expect(state.matrix.convergenceDetectionState.answered).toEqual({});
```

### Criterion 2: "No" (DeadlineAlignment) Recorded Permanently

**Test case continuation (from Criterion 1):**
- Operator responds with `disposition: 'DeadlineAlignment'` to the question

**Expected:**
- Question moves from `pendingQuestions` to `answered`
- Question is recorded as permanent disposition
- Even if detection runs again (data unchanged), same question is never re-asked

**Test assertions:**
```javascript
// After operator response
expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
expect(state.matrix.convergenceDetectionState.answered['q-<id>']).toEqual({
  disposition: 'DeadlineAlignment',
  recordedAtISO: expect.any(String)
});

// After running detection again
const nextState = computeDerivedState(state, { type: 'NO_OP' });
expect(nextState.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
expect(nextState.matrix.convergenceDetectionState.answered['q-<id>'].disposition)
  .toBe('DeadlineAlignment');
```

### Criterion 3: "Yes" (Declared) Routes Through Unmodified Forward-Declaration Path

**Test case continuation (different setup):**
- Create two deliverables: d3, d4 with identical targetDate '2026-09-20'
- Operator responds with `disposition: 'Declared'`

**Expected:**
- Question is marked as answered with `disposition: 'Declared'`
- UI navigation intent is set to forward-declaration screen with pre-filled sourceIds and targetDate
- No convergence edge is actually created by this action alone
- Operator must then submit through the normal `DECLARE_CONVERGENCE` path to create the edge

**Test assertions:**
```javascript
// After operator clicks "Declare"
expect(state.matrix.convergenceDetectionState.answered['q-<id>']).toEqual({
  disposition: 'Declared',
  recordedAtISO: expect.any(String)
});
expect(state.ui.navigationIntent).toEqual({
  route: '#/forward-declaration',
  prefilledConvergence: {
    sourceIds: expect.arrayContaining(['d3', 'd4']),
    targetDate: '2026-09-20',
    detectionQuestionId: 'q-<id>'
  }
});
expect(state.matrix.convergenceEdgesById).toEqual({});  // No edge yet
```

### Criterion 4: Dependency-Excluded Pairs Never Surfaced

**Test case setup:**
- Create two deliverables: d5, d6 with identical targetDate '2026-09-25'
- Create sequential dependency: d5 → d6 (d5 upstream, d6 downstream)

**Expected:**
- Detection pass runs but finds zero questions (dependency-excluded pair is filtered out in `detectConvergenceCandidates()`)
- Advisory panel shows no candidates
- Pair is never asked about as a Convergence opportunity

**Test assertions:**
```javascript
expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
expect(buildConvergenceCandidateAdvisory(state)).toBeNull();
```

---

## Stale Question Pruning (Option B: Delete Outright)

When underlying data changes, stale questions are deleted from `pendingQuestions` in the next detection pass. They are **never** written to `answered` with an `'orphaned'` disposition. This ensures:

- If a source is deleted and later re-added with the same ID, the question re-surfaces (fresh question, fresh answer)
- If a targetDate is edited away and later changed back to the same date, the question re-surfaces

**Pruning logic (in `updateConvergenceDetectionState`):**

Existing `pendingQuestions` are filtered against:
1. All sourceIds still exist in deliverablesById or artifactsById
2. All sources' targetDate still equals the question's targetDate

Questions failing either check are deleted from state (not persisted anywhere).

---

## Dependency Exclusion Rule

**Reuse existing:** Call `validateSourcesNotSequentiallyDependent(sourceIds, dependenciesById)` (already implemented for forward-declaration in Step 2).

Within `detectConvergenceCandidates()`, after identifying a candidate cluster:

```javascript
const depCheck = validateSourcesNotSequentiallyDependent(cluster.sourceIds, matrix.dependenciesById);
if (depCheck.isSequential) {
  // Skip this cluster — it's Deadline Alignment, not Convergence
  continue;
}
```

**No re-implementation of dependency logic** — reuse the existing forward-declaration gate.

---

## Error Handling

### Cases

1. **Detection pass encounters deleted sourceId mid-question:** Pruned in next detection pass (Option B). No error surfaced to operator.
2. **Operator submits forward-declaration for a pre-filled detection question:** Normal forward-declaration validation applies. If validation fails, operator sees standard forward-declaration error messages (not detection-specific).
3. **Memoization hash mismatch (false positive on needsRecompute):** Redundant detection pass runs. Dedup logic prevents duplicate questions. No user-visible impact.

### No exceptions or hard-blocks

Detection is advisory-only. System remains operable if detection encounters edge cases.

---

## Testing Requirements

All acceptance criteria must be demonstrated via real test file: `src/state/__tests__/convergence_detection_pass.test.js`

- Criterion 1 test: `should surface each cluster exactly once`
- Criterion 2 test: `should permanently record 'DeadlineAlignment' disposition`
- Criterion 3 test: `should navigate to forward-declaration on 'Declared' with pre-filled sources`
- Criterion 4 test: `should never surface dependency-excluded pairs`
- Additional tests:
  - Stale question pruning: `should delete questions when sources are removed`
  - Stale question pruning: `should delete questions when targetDate changes`
  - Memoization guard: `should not recompute when matrix hasn't changed`
  - Content-derived ID: `should generate same questionId for same cluster across runs`
  - Dedup: `should not create duplicate questions if same cluster detected twice`

All tests must pass with evidence (not assertions alone — actual state inspection showing before/after).

---

## Out of Scope (Deferred)

- **Mid-cycle Convergences:** A Convergence opportunity discovered *after* initial intake has run (e.g., operator adds new deliverables mid-cycle and they share a deadline with existing deliverables). This detection pass runs at derived-state time and therefore catches only opportunities present at each state mutation. A separate future mechanism would be needed to surface "you just created d7, and it shares d6's deadline" as an immediate imperative. Deferred as separate work.

- **Task 2 Wiring / Step 5 Broader Integration:** This detection pass is standalone additive work within Step 3–4 convergence infrastructure. Step 5 (Task 2 wiring) remains separately scoped and deferred.

---

## Success Criteria

This specification is complete when:

1. ✅ All four acceptance criteria are demonstrated via real test cases
2. ✅ Full test suite passes (no regressions to existing convergence infrastructure)
3. ✅ Advisory panel renders correctly with detected candidates
4. ✅ Operator can answer questions; dispositions persist across state mutations
5. ✅ Navigation to pre-filled forward-declaration works end-to-end
6. ✅ Stale questions are pruned correctly
7. ✅ Dependency-excluded pairs are never surfaced

---

## Notes for Implementation

- The convergence infrastructure (Steps 1–4) is **not modified.** This pass is purely additive.
- Reuse existing functions where possible: `validateSourcesNotSequentiallyDependent()` for dependency exclusion.
- Follow existing immutable-state patterns: `updateConvergenceDetectionState()` returns new state; no in-place mutations.
- Test evidence is critical: Show state before/after, not just boolean assertions.


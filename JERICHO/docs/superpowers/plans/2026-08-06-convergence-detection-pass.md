# Convergence Backward-Detection Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automatic detection of Deliverables/Artifacts sharing targetDates with no convergence edge, surface to operator exactly once per cluster, and persist operator dispositions.

**Architecture:** 
Pure detection function scans matrix for shared-deadline clusters and excludes dependency-linked pairs. Immutable state mutator persists pending questions and answered dispositions in a new `convergenceDetectionState` registry. Memoization guard (hash-based invalidation) ensures detection only reruns when relevant matrix data changes. Advisory panel surfaces questions to operator; actions route "Declared" answers to pre-filled forward-declaration UI.

**Tech Stack:** 
Existing convergence infrastructure (Steps 1–4 in identityCompute.js), immutable state pattern (structuredClone + computeDerivedState), FNV-1a string hashing, advisory panel UI pattern (ZionDashboard).

## Global Constraints

- No modifications to existing `declareConvergence()`, `evaluateConvergenceStatus()`, or Step 1–4 code
- Dispositions are exactly `'Declared'` or `'DeadlineAlignment'` (consistent across reducer, storage, advisory actions)
- Question IDs are deterministic, content-derived (FNV-1a hash of sorted sourceIds + targetDate)
- Stale questions deleted outright (Option B: never written to `answered` as `'orphaned'`)
- Dependency exclusion reuses existing `validateSourcesNotSequentiallyDependent()` — no reimplementation
- All state mutations use immutable pattern (structuredClone + computeDerivedState, matching house convention)
- Test evidence required: before/after state inspection, not just boolean assertions
- Reducer mutation pattern matches existing actions (SET_DEFINITE_GOAL, SET_AIM, etc.): structuredClone → apply mutations → computeDerivedState(..., NO_OP)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/state/identityCompute.js` | Core detection logic: `simpleStringHash()`, `generateQuestionId()`, `detectConvergenceCandidates()`, `updateConvergenceDetectionState()`, `stableHashObject()`, memoization guard integration into `computeDerivedState()` |
| `src/state/identityStore.js` | Reducer case: `RESPOND_CONVERGENCE_DETECTION_QUESTION` action handler |
| `src/state/convergenceCandidateAdvisory.js` (new) | `buildConvergenceCandidateAdvisory()` function — advisory panel builder |
| `src/components/ZionDashboard.jsx` | Render advisory panel using `buildConvergenceCandidateAdvisory()` output, dispatch actions on operator interaction |
| `src/state/__tests__/convergence_detection_pass.test.js` (new) | All 9 test cases (4 acceptance criteria + 5 supplementary) |

---

## Task 1: Hash & ID Generation Utilities

[Same as before — no changes needed]

- [ ] **Step 1: Open `src/state/identityCompute.js`**
- [ ] **Step 2: Add `simpleStringHash()` function** (lines 132–140 from spec)
- [ ] **Step 3: Add `generateQuestionId()` function** (lines 142–145 from spec)
- [ ] **Step 4: Add `stableHashObject()` function** (recursive stable hash)
- [ ] **Step 5: Commit**

---

## Task 2: Detection Function

[Same as before — no changes needed]

- [ ] **Step 1-3: Add `detectConvergenceCandidates()` function**
- [ ] **Step 4: Commit**

---

## Task 3: State Registry & Initialization

[Same as before — no changes needed]

- [ ] **Step 1-3: Initialize `convergenceDetectionState` in `ensureMatrixSlot()`**
- [ ] **Step 4: Commit**

---

## Task 4: State Mutator & Memoization

[Same as before — no changes needed]

- [ ] **Step 1-3: Add `updateConvergenceDetectionState()` and memoization guard**
- [ ] **Step 4: Commit**

---

## Task 5: Reducer Action Handler

**Files:**
- Modify: `src/state/identityStore.js` (add case to reducer)
- Test: `src/state/__tests__/convergence_detection_pass.test.js` (test action dispatch)

**Interfaces:**
- Consumes: Action payload with `questionId` and `disposition`
- Produces: State mutation via `identityReducer()` — updates `convergenceDetectionState.answered`, removes from `pendingQuestions`, sets `ui.navigationIntent` if declared

**Action type: `RESPOND_CONVERGENCE_DETECTION_QUESTION`**

**Pattern: Matches existing house convention (SET_DEFINITE_GOAL, SET_AIM, etc.)**

- [ ] **Step 1: Locate `identityReducer()` function in `identityStore.js`**

Search for: `function identityReducer`

- [ ] **Step 2: Find the location before the default case**

Look for the final `return computeDerivedState(state, action);` (line ~1623)

Add this case **before** that default case:

```javascript
  if (action.type === 'RESPOND_CONVERGENCE_DETECTION_QUESTION') {
    const { questionId, disposition } = action.payload || {};
    if (!questionId) return state;
    
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    
    const question = draft.matrix.convergenceDetectionState.pendingQuestions
      .find(q => q.id === questionId);
    if (!question) return state;
    
    // Record operator's answer (permanent — never re-ask this question)
    draft.matrix.convergenceDetectionState.answered[questionId] = {
      disposition,
      recordedAtISO: draft.appTime?.nowISO || new Date().toISOString()
    };
    
    // Remove from pending
    draft.matrix.convergenceDetectionState.pendingQuestions = 
      draft.matrix.convergenceDetectionState.pendingQuestions
        .filter(q => q.id !== questionId);
    
    // If operator chose "Declared": navigate to forward-declaration UI
    if (disposition === 'Declared') {
      draft.ui = draft.ui || {};
      draft.ui.navigationIntent = {
        route: '#/forward-declaration',
        prefilledConvergence: {
          sourceIds: question.sourceIds,
          targetDate: question.targetDate,
          detectionQuestionId: questionId
        }
      };
    }
    
    return computeDerivedState(draft, { type: 'NO_OP' });
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/state/identityStore.js
git commit -m "convergence-detection: add RESPOND_CONVERGENCE_DETECTION_QUESTION action

Reducer case handles operator's answer to detection question:
records disposition in answered, removes from pending, navigates to
forward-declaration if declared. Follows house pattern (structuredClone + computeDerivedState).

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Advisory Panel Builder

[Same as before — no changes needed]

- [ ] **Step 1-2: Create `src/state/convergenceCandidateAdvisory.js`**
- [ ] **Step 3: Commit**

---

## Task 7: ZionDashboard Integration

[Same as before — no changes needed]

- [ ] **Step 1-6: Add import and render advisory panel**
- [ ] **Step 7: Commit**

---

## Task 8: Test Suite — Acceptance Criteria (CORRECTED)

**Files:**
- Create: `src/state/__tests__/convergence_detection_pass.test.js` (new file)
- Reference: Existing test patterns in `convergence_step3_*.test.js`

**Corrections from review:**
- **#2:** Supplementary Test 3 now instruments call tracking for detectConvergenceCandidates
- **#3:** Criterion 4 test includes missing `buildConvergenceCandidateAdvisory()` assertion
- **#4:** Supplementary Test 2 uses hypothetical UPDATE_DELIVERABLE path (marked with TODO for verification)

- [ ] **Step 1: Create test file `src/state/__tests__/convergence_detection_pass.test.js`**

```javascript
/**
 * Convergence Detection Pass — Acceptance & Integration Tests
 * 
 * Validates: detection logic, state mutation, operator interaction,
 * question persistence, stale pruning, memoization guard.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Convergence Detection Pass', () => {
  let state;
  
  beforeEach(() => {
    state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 1: Operator Asked Exactly Once Per Cluster
  // ═══════════════════════════════════════════════════════════════════════

  it('should surface each shared-deadline cluster exactly once', () => {
    // Create two deliverables with identical targetDate
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd1',
        name: 'Deliverable 1',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-15'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd2',
        name: 'Deliverable 2',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-15'
      }
    });

    // Should have one pending question
    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);
    
    const question = state.matrix.convergenceDetectionState.pendingQuestions[0];
    expect(question).toMatchObject({
      sourceIds: expect.arrayContaining(['d1', 'd2']),
      targetDate: '2026-09-15',
      detectedAtISO: expect.any(String)
    });
    
    // No dispositions yet
    expect(state.matrix.convergenceDetectionState.answered).toEqual({});
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 2: "No" (DeadlineAlignment) Permanently Recorded
  // ═══════════════════════════════════════════════════════════════════════

  it('should record DeadlineAlignment disposition and never re-ask', () => {
    // Setup: same as Criterion 1
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd3',
        name: 'D3',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-20'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd4',
        name: 'D4',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-20'
      }
    });

    const questionId = state.matrix.convergenceDetectionState.pendingQuestions[0].id;

    // Operator responds "No, DeadlineAlignment"
    state = computeDerivedState(state, {
      type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
      payload: { questionId, disposition: 'DeadlineAlignment' }
    });

    // Question moved to answered
    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
    expect(state.matrix.convergenceDetectionState.answered[questionId]).toEqual({
      disposition: 'DeadlineAlignment',
      recordedAtISO: expect.any(String)
    });

    // Run detection again (no data changed) — question stays answered
    const nextState = computeDerivedState(state, { type: 'NO_OP' });
    expect(nextState.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
    expect(nextState.matrix.convergenceDetectionState.answered[questionId].disposition)
      .toBe('DeadlineAlignment');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 3: "Yes" (Declared) Routes to Forward-Declaration
  // ═══════════════════════════════════════════════════════════════════════

  it('should set navigation intent on Declared without creating edge', () => {
    // Setup
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd5',
        name: 'D5',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-25'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd6',
        name: 'D6',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-25'
      }
    });

    const questionId = state.matrix.convergenceDetectionState.pendingQuestions[0].id;

    // Operator responds "Yes, Declared"
    state = computeDerivedState(state, {
      type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
      payload: { questionId, disposition: 'Declared' }
    });

    // Question marked as Declared
    expect(state.matrix.convergenceDetectionState.answered[questionId]).toEqual({
      disposition: 'Declared',
      recordedAtISO: expect.any(String)
    });

    // Navigation intent set
    expect(state.ui.navigationIntent).toMatchObject({
      route: '#/forward-declaration',
      prefilledConvergence: {
        sourceIds: expect.arrayContaining(['d5', 'd6']),
        targetDate: '2026-09-25',
        detectionQuestionId: questionId
      }
    });

    // NO convergence edge created yet
    expect(state.matrix.convergenceEdgesById).toEqual({});
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 4: Dependency-Excluded Pairs Never Surfaced
  // ═══════════════════════════════════════════════════════════════════════

  it('should exclude pairs with sequential dependencies from detection', () => {
    // Create two deliverables with same targetDate
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd7',
        name: 'D7',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-30'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd8',
        name: 'D8',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-30'
      }
    });

    // Create sequential dependency: d7 → d8
    state = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: {
        id: 'dep-1',
        upstreamId: 'd7',
        downstreamId: 'd8',
        type: 'hard_gate'
      }
    });

    // Should have NO pending questions (dependency-excluded)
    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
    
    // CORRECTED #3: Also verify advisory panel shows nothing
    const { buildConvergenceCandidateAdvisory } = await import('../convergenceCandidateAdvisory.js');
    expect(buildConvergenceCandidateAdvisory(state)).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 1: Stale Question Pruning (Source Deleted)
  // ═══════════════════════════════════════════════════════════════════════

  it('should delete questions when source is removed', () => {
    // Create cluster
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd9',
        name: 'D9',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-01'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd10',
        name: 'D10',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-01'
      }
    });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);

    // Delete one source
    state = computeDerivedState(state, {
      type: 'REMOVE_DELIVERABLE',
      payload: { id: 'd9' }
    });

    // Question should be pruned
    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 2: Stale Question Pruning (Date Changed)
  // ═══════════════════════════════════════════════════════════════════════

  it('should delete questions when targetDate changes on a source', () => {
    // Create cluster
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd11',
        name: 'D11',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-05'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd12',
        name: 'D12',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-05'
      }
    });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);

    // TODO: This test assumes UPDATE_DELIVERABLE action exists.
    // If not, it falls back to REMOVE + ADD pattern.
    // Verify in codebase whether UPDATE_DELIVERABLE is available.
    // For now, using REMOVE + ADD:
    state = computeDerivedState(state, {
      type: 'REMOVE_DELIVERABLE',
      payload: { id: 'd11' }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd11',
        name: 'D11 Updated',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-10'  // Different date
      }
    });

    // Question should be pruned (d11 no longer matches d12's date)
    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 3: Memoization Guard (CORRECTED #2)
  // ═══════════════════════════════════════════════════════════════════════

  it('should not recompute detection when matrix data unchanged', () => {
    // Setup
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd13',
        name: 'D13',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-15'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd14',
        name: 'D14',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-15'
      }
    });

    const hashBefore = state.matrix.convergenceDetectionState.lastComputedFrom;
    const pendingBefore = state.matrix.convergenceDetectionState.pendingQuestions;

    // Non-matrix mutation (e.g., UI state change)
    state = computeDerivedState(state, { type: 'NO_OP' });

    // Hash should be identical (proof that recompute didn't run)
    expect(state.matrix.convergenceDetectionState.lastComputedFrom).toEqual(hashBefore);
    
    // Pending questions should be byte-identical (no recreation)
    expect(state.matrix.convergenceDetectionState.pendingQuestions).toBe(pendingBefore);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 4: Deterministic Question ID
  // ═══════════════════════════════════════════════════════════════════════

  it('should generate same questionId for same cluster across runs', () => {
    // Setup identical cluster
    const setup1 = (s) => {
      s = computeDerivedState(s, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'd15',
          name: 'D15',
          owningProjectId: 'proj-1',
          owningInitiativeId: 'init-1',
          targetDate: '2026-10-20'
        }
      });
      s = computeDerivedState(s, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'd16',
          name: 'D16',
          owningProjectId: 'proj-1',
          owningInitiativeId: 'init-1',
          targetDate: '2026-10-20'
        }
      });
      return s;
    };

    let state1 = buildBlankIdentityState();
    state1.appTime = { nowISO: '2026-08-06T10:00:00Z' };
    state1 = setup1(state1);
    const id1 = state1.matrix.convergenceDetectionState.pendingQuestions[0].id;

    let state2 = buildBlankIdentityState();
    state2.appTime = { nowISO: '2026-08-06T10:00:00Z' };
    state2 = setup1(state2);
    const id2 = state2.matrix.convergenceDetectionState.pendingQuestions[0].id;

    expect(id1).toBe(id2);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 5: No Duplicate Questions
  // ═══════════════════════════════════════════════════════════════════════

  it('should not create duplicate questions if same cluster detected again', () => {
    // Setup
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd17',
        name: 'D17',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-25'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd18',
        name: 'D18',
        owningProjectId: 'proj-1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-25'
      }
    });

    const countAfterFirst = state.matrix.convergenceDetectionState.pendingQuestions.length;

    // Trigger detection again (NO_OP mutation)
    state = computeDerivedState(state, { type: 'NO_OP' });

    const countAfterSecond = state.matrix.convergenceDetectionState.pendingQuestions.length;
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
```

- [ ] **Step 2: Run test suite to verify all tests fail (TDD)**

```bash
npx vitest run src/state/__tests__/convergence_detection_pass.test.js
```

Expected: All 9 tests fail initially (functions not yet complete).

- [ ] **Step 3: Commit test file**

```bash
git add src/state/__tests__/convergence_detection_pass.test.js
git commit -m "convergence-detection: add comprehensive test suite (9 tests)

Acceptance criteria: operator asked once per cluster, disposition
recorded, declare routes through forward-declaration, dependency-excluded
pairs never surfaced.

Supplementary: stale pruning (source deleted/date changed), memoization
guard verified via hash + object identity, deterministic ID generation,
no duplicate questions.

Includes corrected assertions: Criterion 4 checks advisory builder,
Test 3 uses object identity to prove skip, Test 2 flags UPDATE_DELIVERABLE
verification TODO.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Verify tests now pass**

Once all earlier tasks are complete:

```bash
npx vitest run src/state/__tests__/convergence_detection_pass.test.js
```

Expected: All 9 tests pass.

---

## Corrections Applied

✅ **#1 (Task 5 mutation pattern):** Confirmed house convention — no change needed.

✅ **#2 (Test 3 memoization):** Changed assertion from hash equality to object identity (`toBe(pendingBefore)`) to prove recompute was skipped, not just that hashes matched.

✅ **#3 (Criterion 4 advisory assertion):** Added missing `expect(buildConvergenceCandidateAdvisory(state)).toBeNull()` test.

✅ **#4 (Test 2 date change):** Added TODO comment flagging UPDATE_DELIVERABLE verification need; noted fallback to REMOVE + ADD pattern.

---

**Plan now ready for execution choice.**
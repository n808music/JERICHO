/**
 * Convergence Detection Pass — Acceptance & Integration Tests
 *
 * Validates: detection logic, state mutation, operator interaction,
 * question persistence, stale pruning, memoization guard.
 *
 * 9 tests total: 4 acceptance criteria + 5 supplementary
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
    // Setup: Create initiative first
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'init-1',
        name: 'Initiative 1'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd1',
        name: 'Deliverable 1',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-15',
        requiredBlocks: 5
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd2',
        name: 'Deliverable 2',
        owningInitiativeId: 'init-1',
        targetDate: '2026-09-15',
        requiredBlocks: 5
      }
    });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);

    const question = state.matrix.convergenceDetectionState.pendingQuestions[0];
    expect(question).toMatchObject({
      sourceIds: expect.arrayContaining(['d1', 'd2']),
      targetDate: '2026-09-15',
      detectedAtISO: expect.any(String)
    });
    expect(state.matrix.convergenceDetectionState.answered).toEqual({});
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 2: "No" (DeadlineAlignment) Permanently Recorded
  // ═══════════════════════════════════════════════════════════════════════

  it('should record DeadlineAlignment disposition and never re-ask', () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: { id: 'init-2', name: 'Initiative 2' }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd3',
        name: 'D3',
        owningInitiativeId: 'init-2',
        targetDate: '2026-09-20'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd4',
        name: 'D4',
        owningInitiativeId: 'init-2',
        targetDate: '2026-09-20'
      }
    });

    const questionId = state.matrix.convergenceDetectionState.pendingQuestions[0].id;

    state = computeDerivedState(state, {
      type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
      payload: { questionId, disposition: 'DeadlineAlignment' }
    });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
    expect(state.matrix.convergenceDetectionState.answered[questionId]).toEqual({
      disposition: 'DeadlineAlignment',
      recordedAtISO: expect.any(String)
    });

    const nextState = computeDerivedState(state, { type: 'NO_OP' });
    expect(nextState.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
    expect(nextState.matrix.convergenceDetectionState.answered[questionId].disposition)
      .toBe('DeadlineAlignment');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 3: "Yes" (Declared) Routes to Forward-Declaration
  // ═══════════════════════════════════════════════════════════════════════

  it('should set navigation intent on Declared without creating edge', () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: { id: 'init-3', name: 'Initiative 3' }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd5',
        name: 'D5',
        owningInitiativeId: 'init-3',
        targetDate: '2026-09-25'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd6',
        name: 'D6',
        owningInitiativeId: 'init-3',
        targetDate: '2026-09-25'
      }
    });

    const questionId = state.matrix.convergenceDetectionState.pendingQuestions[0].id;

    state = computeDerivedState(state, {
      type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
      payload: { questionId, disposition: 'Declared' }
    });

    expect(state.matrix.convergenceDetectionState.answered[questionId]).toEqual({
      disposition: 'Declared',
      recordedAtISO: expect.any(String)
    });

    expect(state.ui.navigationIntent).toMatchObject({
      route: '#/forward-declaration',
      prefilledConvergence: {
        sourceIds: expect.arrayContaining(['d5', 'd6']),
        targetDate: '2026-09-25',
        detectionQuestionId: questionId
      }
    });

    expect(state.matrix.convergenceEdgesById).toEqual({});
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 4: Dependency-Excluded Pairs Never Surfaced
  // ═══════════════════════════════════════════════════════════════════════

  it('should exclude pairs with sequential dependencies from detection', async () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: { id: 'init-4', name: 'Initiative 4' }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd7',
        name: 'D7',
        owningInitiativeId: 'init-4',
        targetDate: '2026-09-30'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd8',
        name: 'D8',
        owningInitiativeId: 'init-4',
        targetDate: '2026-09-30'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: {
        id: 'dep-1',
        upstreamId: 'd7',
        downstreamId: 'd8',
        type: 'hard_gate'
      }
    });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);

    const { buildConvergenceCandidateAdvisory } = await import('../convergenceCandidateAdvisory.js');
    expect(buildConvergenceCandidateAdvisory(state)).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 1: Stale Question Pruning (Source Deleted)
  // ═══════════════════════════════════════════════════════════════════════

  it('should delete questions when source is removed', () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: { id: 'init-5', name: 'Initiative 5' }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd9',
        name: 'D9',
        owningInitiativeId: 'init-5',
        targetDate: '2026-10-01'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd10',
        name: 'D10',
        owningInitiativeId: 'init-5',
        targetDate: '2026-10-01'
      }
    });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);

    state = computeDerivedState(state, {
      type: 'REMOVE_DELIVERABLE',
      payload: { id: 'd9' }
    });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 2: Stale Question Pruning (Date Changed)
  // ═══════════════════════════════════════════════════════════════════════

  it('should delete questions when targetDate changes on a source', () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: { id: 'init-6', name: 'Initiative 6' }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd11',
        name: 'D11',
        owningInitiativeId: 'init-6',
        targetDate: '2026-10-05'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd12',
        name: 'D12',
        owningInitiativeId: 'init-6',
        targetDate: '2026-10-05'
      }
    });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);

    // Use UPDATE_DELIVERABLE to change targetDate
    state = computeDerivedState(state, {
      type: 'UPDATE_DELIVERABLE',
      payload: {
        id: 'd11',
        updates: { targetDate: '2026-10-10' }
      }
    });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 3: Memoization Guard
  // ═══════════════════════════════════════════════════════════════════════

  it('should not recompute detection when matrix data unchanged', () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: { id: 'init-7', name: 'Initiative 7' }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd13',
        name: 'D13',
        owningInitiativeId: 'init-7',
        targetDate: '2026-10-15'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd14',
        name: 'D14',
        owningInitiativeId: 'init-7',
        targetDate: '2026-10-15'
      }
    });

    const pendingBefore = state.matrix.convergenceDetectionState.pendingQuestions;

    state = computeDerivedState(state, { type: 'NO_OP' });

    expect(state.matrix.convergenceDetectionState.pendingQuestions).toBe(pendingBefore);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 4: Deterministic Question ID
  // ═══════════════════════════════════════════════════════════════════════

  it('should generate same questionId for same cluster across runs', () => {
    const setup = (s) => {
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
    state1 = setup(state1);
    const id1 = state1.matrix.convergenceDetectionState.pendingQuestions[0].id;

    let state2 = buildBlankIdentityState();
    state2.appTime = { nowISO: '2026-08-06T10:00:00Z' };
    state2 = setup(state2);
    const id2 = state2.matrix.convergenceDetectionState.pendingQuestions[0].id;

    expect(id1).toBe(id2);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 5: No Duplicate Questions
  // ═══════════════════════════════════════════════════════════════════════

  it('should not create duplicate questions if same cluster detected again', () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd17',
        name: 'D17',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-25'
      }
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'd18',
        name: 'D18',
        owningInitiativeId: 'init-1',
        targetDate: '2026-10-25'
      }
    });

    const countAfterFirst = state.matrix.convergenceDetectionState.pendingQuestions.length;

    state = computeDerivedState(state, { type: 'NO_OP' });

    const countAfterSecond = state.matrix.convergenceDetectionState.pendingQuestions.length;
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});

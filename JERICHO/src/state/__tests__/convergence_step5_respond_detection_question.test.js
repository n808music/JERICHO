/**
 * Convergence Lifecycle Step 5: Operator Response Handler
 *
 * Tests the RESPOND_CONVERGENCE_DETECTION_QUESTION reducer case:
 * 1. Records operator disposition in answered map
 * 2. Removes question from pendingQuestions
 * 3. Declared disposition routes to forward-declaration
 * 4. DeadlineAlignment disposition does NOT set navigation
 * 5. Handles missing questionId gracefully
 * 6. Handles question not found gracefully
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildBlankIdentityState, identityReducer } from '../identityStore.js';
import { generateQuestionId } from '../identityCompute.js';

function seedConvergenceDetectionState(state) {
  return identityReducer(state, {
    type: 'INITIALIZE_CONVERGENCE_DETECTION',
    payload: {
      pendingQuestions: [
        {
          id: 'q-001',
          text: 'Do you declare convergence between E1 and E2?',
          sourceIds: ['e1', 'e2'],
          targetDate: '2026-08-15',
        },
        {
          id: 'q-002',
          text: 'Do you declare convergence between E2 and E3?',
          sourceIds: ['e2', 'e3'],
          targetDate: '2026-08-20',
        },
      ],
      answered: {},
    },
  });
}

describe('Convergence Step 5: RESPOND_CONVERGENCE_DETECTION_QUESTION', () => {
  let state;
  let q1Id; // ID for question with sourceIds ['e1', 'e2'], targetDate '2026-08-15'
  let q2Id; // ID for question with sourceIds ['e2', 'e3'], targetDate '2026-08-20'

  beforeEach(() => {
    state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    // Pre-compute expected question IDs
    q1Id = generateQuestionId(['e1', 'e2'], '2026-08-15');
    q2Id = generateQuestionId(['e3', 'e4'], '2026-08-20');

    // Initialize matrix.convergenceDetectionState if it doesn't exist
    if (!state.matrix) {
      state.matrix = {};
    }

    // Create deliverables in the matrix to support the questions
    // Note: Each question must have sourceIds where ALL have the same targetDate
    state.matrix.deliverablesById = {
      e1: {
        id: 'e1',
        name: 'Entity 1',
        targetDate: '2026-08-15',
        owningInitiativeId: 'init-1',
      },
      e2: {
        id: 'e2',
        name: 'Entity 2',
        targetDate: '2026-08-15',
        owningInitiativeId: 'init-1',
      },
      e3: {
        id: 'e3',
        name: 'Entity 3',
        targetDate: '2026-08-20',
        owningInitiativeId: 'init-2',
      },
      e4: {
        id: 'e4',
        name: 'Entity 4',
        targetDate: '2026-08-20',
        owningInitiativeId: 'init-2',
      },
    };

    if (!state.matrix.convergenceDetectionState) {
      state.matrix.convergenceDetectionState = {
        pendingQuestions: [
          {
            id: q1Id,
            text: 'Do you declare convergence between E1 and E2?',
            sourceIds: ['e1', 'e2'],
            targetDate: '2026-08-15',
          },
          {
            id: q2Id,
            text: 'Do you declare convergence between E3 and E4?',
            sourceIds: ['e3', 'e4'],
            targetDate: '2026-08-20',
          },
        ],
        answered: {},
        lastComputedFrom: {
          deliverablesById: null,
          artifactsById: null,
          dependenciesById: null,
          convergenceEdgesById: null,
        },
      };
    }
  });

  describe('Criterion 1: Missing questionId', () => {
    it('should return state unchanged when questionId is missing', () => {
      const originalState = state;
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          // questionId is missing
          disposition: 'Declared',
        },
      });
      expect(nextState).toBe(originalState);
    });

    it('should return state unchanged when payload is empty', () => {
      const originalState = state;
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {},
      });
      expect(nextState).toBe(originalState);
    });

    it('should return state unchanged when payload is null', () => {
      const originalState = state;
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: null,
      });
      expect(nextState).toBe(originalState);
    });

    it('should return state unchanged when questionId is not found', () => {
      const originalState = state;
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: 'nonexistent-question-id',
          disposition: 'Declared',
        },
      });
      expect(nextState).toBe(originalState);
    });
  });

  describe('Criterion 2: DeadlineAlignment Disposition', () => {
    it('should record DeadlineAlignment disposition in answered map', () => {
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'DeadlineAlignment',
        },
      });

      const answered = nextState.matrix.convergenceDetectionState.answered[q1Id];
      expect(answered).toBeDefined();
      expect(answered.disposition).toBe('DeadlineAlignment');
      expect(answered.recordedAtISO).toBeDefined();
    });

    it('should remove question from pendingQuestions when DeadlineAlignment', () => {
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'DeadlineAlignment',
        },
      });

      const pending = nextState.matrix.convergenceDetectionState.pendingQuestions;
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(q2Id);
      expect(pending.some(q => q.id === q1Id)).toBe(false);
    });

    it('should NOT set navigationIntent when DeadlineAlignment', () => {
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'DeadlineAlignment',
        },
      });

      expect(nextState.ui?.navigationIntent).toBeUndefined();
    });
  });

  describe('Criterion 3: Declared Disposition', () => {
    it('should record Declared disposition in answered map', () => {
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'Declared',
        },
      });

      const answered = nextState.matrix.convergenceDetectionState.answered[q1Id];
      expect(answered).toBeDefined();
      expect(answered.disposition).toBe('Declared');
      expect(answered.recordedAtISO).toBeDefined();
    });

    it('should remove question from pendingQuestions when Declared', () => {
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'Declared',
        },
      });

      const pending = nextState.matrix.convergenceDetectionState.pendingQuestions;
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(q2Id);
      expect(pending.some(q => q.id === q1Id)).toBe(false);
    });

    it('should set navigationIntent to forward-declaration when Declared', () => {
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'Declared',
        },
      });

      const navIntent = nextState.ui?.navigationIntent;
      expect(navIntent).toBeDefined();
      expect(navIntent.route).toBe('#/forward-declaration');
    });

    it('should prefill convergence data in navigationIntent', () => {
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'Declared',
        },
      });

      const prefilledConvergence = nextState.ui.navigationIntent.prefilledConvergence;
      expect(prefilledConvergence).toBeDefined();
      expect(prefilledConvergence.sourceIds).toEqual(['e1', 'e2']);
      expect(prefilledConvergence.targetDate).toBe('2026-08-15');
      expect(prefilledConvergence.detectionQuestionId).toBe(q1Id);
    });
  });


  describe('Criterion 5: Immutable Pattern', () => {
    it('should not mutate input state', () => {
      const originalState = JSON.parse(JSON.stringify(state));
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'Declared',
        },
      });

      expect(state).toEqual(originalState);
      expect(nextState).not.toBe(state);
    });

    it('should preserve other questions when responding to one', () => {
      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'Declared',
        },
      });

      const q2 = nextState.matrix.convergenceDetectionState.pendingQuestions.find(
        q => q.id === q2Id
      );
      expect(q2).toBeDefined();
      expect(q2.text).toBe('Do you declare convergence between E3 and E4?');
      expect(q2.sourceIds).toEqual(['e3', 'e4']);
    });
  });

  describe('Criterion 6: Multiple Responses', () => {
    it('should handle multiple question responses in sequence', () => {
      let nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'Declared',
        },
      });

      expect(nextState.matrix.convergenceDetectionState.pendingQuestions.length).toBe(1);
      expect(nextState.matrix.convergenceDetectionState.answered[q1Id]).toBeDefined();

      // Respond to second question
      nextState = identityReducer(nextState, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q2Id,
          disposition: 'DeadlineAlignment',
        },
      });

      expect(nextState.matrix.convergenceDetectionState.pendingQuestions.length).toBe(0);
      expect(nextState.matrix.convergenceDetectionState.answered[q2Id]).toBeDefined();
      expect(nextState.matrix.convergenceDetectionState.answered[q2Id].disposition).toBe(
        'DeadlineAlignment'
      );
    });
  });

  describe('Criterion 7: Timestamp Recording', () => {
    it('should record ISO timestamp when question is answered', () => {
      state.appTime.nowISO = '2026-08-06T15:30:45Z';

      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'Declared',
        },
      });

      const answered = nextState.matrix.convergenceDetectionState.answered[q1Id];
      expect(answered.recordedAtISO).toBe('2026-08-06T15:30:45Z');
    });

    it('should use current date if appTime.nowISO is not set', () => {
      delete state.appTime.nowISO;

      const nextState = identityReducer(state, {
        type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
        payload: {
          questionId: q1Id,
          disposition: 'Declared',
        },
      });

      const answered = nextState.matrix.convergenceDetectionState.answered[q1Id];
      expect(answered.recordedAtISO).toBeDefined();
      expect(typeof answered.recordedAtISO).toBe('string');
      expect(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(answered.recordedAtISO)).toBe(true);
    });
  });
});

/**
 * Convergence Step 3 Reschedule: Piece 2 — Three-Way Disposition Mechanism
 *
 * Operator assigns per-source dispositions:
 * - Satisfied: completion value holds (only valid for priorCompletion sources)
 * - Needs Redo: re-enter as active work (valid for both prior states)
 * - Removed: decouple entirely (valid for both prior states)
 *
 * Hard validation enforces semantic correctness.
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Step 3 Reschedule Piece 2: Three-Way Disposition', () => {
  // Helper: Create a test edge with completed and missed sources
  function setupPartialEdge(state) {
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'vs-disp', domain: 'testing', source: 'manual' },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-disp-src',
        name: 'Source',
        roleTags: ['source'],
        purpose: 'Test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'init-disp',
        name: 'Initiative',
        purpose: 'Test',
        classification: 'objective',
        doneWhen: 'Complete',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-disp',
        name: 'Project',
        owningEntityId: 'entity-disp-src',
        description: 'Complete',
        verificationSourceId: 'vs-disp',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-disp-completed',
        name: 'Completed',
        owningInitiativeId: 'init-disp',
        owningProjectId: 'proj-disp',
        requiredBlocks: 5,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-disp-missed',
        name: 'Missed',
        owningInitiativeId: 'init-disp',
        owningProjectId: 'proj-disp',
        requiredBlocks: 5,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-disp-dest',
        name: 'Destination',
        roleTags: ['destination'],
        purpose: 'Test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-disp',
        fromNodeId: 'init-disp',
        toNodeId: 'entity-disp-dest',
        gives: 'test',
        name: 'Disposition Test',
        targetDate: '2026-09-15',
      },
    });

    // Mark one completed, leave one missed
    state.matrix.deliverablesById['deliv-disp-completed'].completionEvidence = 'Done';
    state.matrix.deliverablesById['deliv-disp-completed'].completedOnISO = '2026-09-10T10:00:00Z';

    // Evaluate to PARTIAL
    state = computeDerivedState(state, {
      type: 'UPDATE_CONVERGENCE_STATUSES',
      payload: { evaluationDate: '2026-09-15' },
    });

    // Initiate reschedule
    state = computeDerivedState(state, {
      type: 'PROCESS_MISSED_CONVERGENCE',
      payload: {
        edgeId: 'conv-disp',
        action: {
          type: 'RESCHEDULE',
          completionState: {
            completed: ['deliv-disp-completed'],
            missed: ['deliv-disp-missed'],
          },
        },
      },
    });

    return state;
  }

  it('accepts valid dispositions for completed and missed sources', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    state = setupPartialEdge(state);

    const edge = state.matrix.convergenceEdgesById['conv-disp'];
    const reassessmentSessionId = edge.reassessmentSessionId;

    // VALID CASE 1: Completed source marked Satisfied
    state = computeDerivedState(state, {
      type: 'COMPLETE_REASSESSMENT',
      payload: {
        reassessmentSessionId,
        sourceDispositions: {
          'deliv-disp-completed': 'Satisfied', // Valid: was completed
          'deliv-disp-missed': 'Needs Redo', // Valid: was missed, re-enter as work
        },
      },
    });

    expect(state.lastPlanError).toBeNull();

    const updatedEdge = state.matrix.convergenceEdgesById['conv-disp'];
    expect(updatedEdge.sourceDispositions).toBeDefined();
    expect(updatedEdge.sourceDispositions['deliv-disp-completed']).toBe('Satisfied');
    expect(updatedEdge.sourceDispositions['deliv-disp-missed']).toBe('Needs Redo');
    expect(updatedEdge.reassessmentCompletedAtISO).toBeDefined();

    console.log('✅ Valid Dispositions Test PASSED:');
    console.log('   - Completed source: Satisfied');
    console.log('   - Missed source: Needs Redo');
    console.log('   - Dispositions stored on edge');
  });

  it('HARD-BLOCKS: Satisfied disposition for source that was never completed', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    state = setupPartialEdge(state);

    const edge = state.matrix.convergenceEdgesById['conv-disp'];
    const reassessmentSessionId = edge.reassessmentSessionId;

    // INVALID CASE: Missed source marked Satisfied (contradiction)
    state = computeDerivedState(state, {
      type: 'COMPLETE_REASSESSMENT',
      payload: {
        reassessmentSessionId,
        sourceDispositions: {
          'deliv-disp-completed': 'Satisfied',
          'deliv-disp-missed': 'Satisfied', // INVALID: was never completed
        },
      },
    });

    // Verify hard-block error
    expect(state.lastPlanError?.code).toBe('REASSESSMENT_SATISFIED_INVALID');
    expect(state.lastPlanError?.meta?.sourceId).toBe('deliv-disp-missed');

    // Verify edge NOT updated (sourceDispositions remains null)
    const updatedEdge = state.matrix.convergenceEdgesById['conv-disp'];
    expect(updatedEdge.sourceDispositions).toBeNull();

    console.log('✅ Hard-Block Validation Test PASSED:');
    console.log('   - Attempted to mark never-completed source as Satisfied');
    console.log('   - Error code:', state.lastPlanError?.code);
    console.log('   - Dispositions NOT stored (hard-block rejected)');
  });

  it('validates Needs Redo is valid for both prior states', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    state = setupPartialEdge(state);

    const edge = state.matrix.convergenceEdgesById['conv-disp'];
    const reassessmentSessionId = edge.reassessmentSessionId;

    // CASE: Both sources marked Needs Redo (valid for both)
    state = computeDerivedState(state, {
      type: 'COMPLETE_REASSESSMENT',
      payload: {
        reassessmentSessionId,
        sourceDispositions: {
          'deliv-disp-completed': 'Needs Redo', // Valid: rework stale completion
          'deliv-disp-missed': 'Needs Redo', // Valid: retry missed
        },
      },
    });

    expect(state.lastPlanError).toBeNull();

    const updatedEdge = state.matrix.convergenceEdgesById['conv-disp'];
    expect(updatedEdge.sourceDispositions['deliv-disp-completed']).toBe('Needs Redo');
    expect(updatedEdge.sourceDispositions['deliv-disp-missed']).toBe('Needs Redo');

    console.log('✅ Needs Redo Valid for Both Test PASSED:');
    console.log('   - Completed source marked Needs Redo (rework stale): valid');
    console.log('   - Missed source marked Needs Redo (retry): valid');
  });

  it('validates Removed is valid for both prior states', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    state = setupPartialEdge(state);

    const edge = state.matrix.convergenceEdgesById['conv-disp'];
    const reassessmentSessionId = edge.reassessmentSessionId;

    // CASE: Both sources marked Removed (valid for both)
    state = computeDerivedState(state, {
      type: 'COMPLETE_REASSESSMENT',
      payload: {
        reassessmentSessionId,
        sourceDispositions: {
          'deliv-disp-completed': 'Removed', // Valid: decouple completed
          'deliv-disp-missed': 'Removed', // Valid: decouple missed
        },
      },
    });

    expect(state.lastPlanError).toBeNull();

    const updatedEdge = state.matrix.convergenceEdgesById['conv-disp'];
    expect(updatedEdge.sourceDispositions['deliv-disp-completed']).toBe('Removed');
    expect(updatedEdge.sourceDispositions['deliv-disp-missed']).toBe('Removed');

    console.log('✅ Removed Valid for Both Test PASSED:');
    console.log('   - Completed source marked Removed (decouple): valid');
    console.log('   - Missed source marked Removed (decouple): valid');
  });

  it('rejects missing disposition for any source', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    state = setupPartialEdge(state);

    const edge = state.matrix.convergenceEdgesById['conv-disp'];
    const reassessmentSessionId = edge.reassessmentSessionId;

    // INVALID CASE: Missing disposition for one source
    state = computeDerivedState(state, {
      type: 'COMPLETE_REASSESSMENT',
      payload: {
        reassessmentSessionId,
        sourceDispositions: {
          'deliv-disp-completed': 'Satisfied',
          // 'deliv-disp-missed' missing
        },
      },
    });

    expect(state.lastPlanError?.code).toBe('REASSESSMENT_MISSING_DISPOSITION');
    expect(state.lastPlanError?.meta?.sourceId).toBe('deliv-disp-missed');

    const updatedEdge = state.matrix.convergenceEdgesById['conv-disp'];
    expect(updatedEdge.sourceDispositions).toBeNull();

    console.log('✅ Missing Disposition Validation Test PASSED:');
    console.log('   - Attempted to skip disposition for one source');
    console.log('   - Error code:', state.lastPlanError?.code);
  });

  it('rejects invalid disposition value', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    state = setupPartialEdge(state);

    const edge = state.matrix.convergenceEdgesById['conv-disp'];
    const reassessmentSessionId = edge.reassessmentSessionId;

    // INVALID CASE: Typo or invalid disposition
    state = computeDerivedState(state, {
      type: 'COMPLETE_REASSESSMENT',
      payload: {
        reassessmentSessionId,
        sourceDispositions: {
          'deliv-disp-completed': 'Satisfied',
          'deliv-disp-missed': 'InvalidOption', // Not one of 3 valid values
        },
      },
    });

    expect(state.lastPlanError?.code).toBe('REASSESSMENT_INVALID_DISPOSITION');
    expect(state.lastPlanError?.meta?.disposition).toBe('InvalidOption');

    const updatedEdge = state.matrix.convergenceEdgesById['conv-disp'];
    expect(updatedEdge.sourceDispositions).toBeNull();

    console.log('✅ Invalid Disposition Value Test PASSED:');
    console.log('   - Attempted invalid disposition value');
    console.log('   - Error code:', state.lastPlanError?.code);
  });
});

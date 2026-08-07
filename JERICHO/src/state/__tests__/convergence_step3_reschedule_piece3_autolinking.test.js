/**
 * Convergence Step 3 Reschedule: Piece 3 — Automatic Linking
 *
 * CRITICAL PROOF: When operator declares a new edge from a reassessment session,
 * the system automatically sets supersedes/supersededBy WITHOUT manual edge ID entry.
 *
 * This closes the gap from the previous report where supersededBy was null.
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Step 3 Reschedule Piece 3: Automatic Linking', () => {
  it('automatically links via supersedes/supersededBy without manual ID entry', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    // Setup: Create a PARTIAL edge, initiate reschedule
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'vs-link', domain: 'testing', source: 'manual' },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-link-src',
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
        id: 'init-link',
        name: 'Initiative',
        purpose: 'Test',
        classification: 'objective',
        doneWhen: 'Complete',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-link',
        name: 'Project',
        owningEntityId: 'entity-link-src',
        successMetric: 'Complete',
        verificationSourceId: 'vs-link',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-link-completed',
        name: 'Completed',
        owningInitiativeId: 'init-link',
        owningProjectId: 'proj-link',
        requiredBlocks: 5,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-link-missed',
        name: 'Missed',
        owningInitiativeId: 'init-link',
        owningProjectId: 'proj-link',
        requiredBlocks: 5,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-link-dest',
        name: 'Destination',
        roleTags: ['destination'],
        purpose: 'Test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    // Declare ORIGINAL convergence edge
    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-link-original',
        fromNodeId: 'init-link',
        toNodeId: 'entity-link-dest',
        gives: 'test',
        name: 'Original Convergence',
        targetDate: '2026-09-15',
      },
    });

    // Mark one completed, one missed
    state.matrix.deliverablesById['deliv-link-completed'].completionEvidence = 'Done';
    state.matrix.deliverablesById['deliv-link-completed'].completedOnISO = '2026-09-10T10:00:00Z';

    // Evaluate to PARTIAL
    state = computeDerivedState(state, {
      type: 'UPDATE_CONVERGENCE_STATUSES',
      payload: { evaluationDate: '2026-09-15' },
    });

    // Initiate reschedule
    state = computeDerivedState(state, {
      type: 'PROCESS_MISSED_CONVERGENCE',
      payload: {
        edgeId: 'conv-link-original',
        action: {
          type: 'RESCHEDULE',
          completionState: {
            completed: ['deliv-link-completed'],
            missed: ['deliv-link-missed'],
          },
        },
      },
    });

    // Get reassessment session ID
    const originalEdge = state.matrix.convergenceEdgesById['conv-link-original'];
    const reassessmentSessionId = originalEdge.reassessmentSessionId;
    expect(reassessmentSessionId).toBeDefined();

    // Complete reassessment with dispositions
    state = computeDerivedState(state, {
      type: 'COMPLETE_REASSESSMENT',
      payload: {
        reassessmentSessionId,
        sourceDispositions: {
          'deliv-link-completed': 'Satisfied',
          'deliv-link-missed': 'Needs Redo',
        },
      },
    });

    // ============================================================
    // PIECE 3 TEST: Declare new edge from reassessment
    // KEY: Operator provides ONLY reassessmentSessionId, NOT edge IDs
    // ============================================================

    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-link-rescheduled',
        fromNodeId: 'init-link',
        toNodeId: 'entity-link-dest',
        gives: 'test after reassessment',
        name: 'Rescheduled Convergence',
        targetDate: '2026-10-15',
        // KEY POINT: Only reassessmentSessionId provided
        reassessmentSessionId,
        // NO manual edge ID entry like "supersedes: 'conv-link-original'"
        // System infers it automatically
      },
    });

    // ============================================================
    // PIECE 3 PROOF: Automatic linking worked
    // ============================================================

    const newEdge = state.matrix.convergenceEdgesById['conv-link-rescheduled'];
    expect(newEdge).toBeDefined();

    // CRITICAL: supersedes should be AUTOMATICALLY populated (not null)
    console.log('✅ New Edge Linking:');
    console.log('   ID:', newEdge.id);
    console.log('   supersedes:', newEdge.supersedes);
    console.log('   Name:', newEdge.name);
    console.log('   TargetDate:', newEdge.targetDate);

    expect(newEdge.supersedes).toBe('conv-link-original');
    expect(newEdge.supersedes).not.toBeNull(); // THE KEY POINT: not null anymore

    // Verify original edge's supersededBy was updated
    const updatedOriginalEdge = state.matrix.convergenceEdgesById['conv-link-original'];
    expect(updatedOriginalEdge.supersededBy).toBe('conv-link-rescheduled');
    expect(updatedOriginalEdge.supersededBy).not.toBeNull(); // No longer null

    console.log('   \n✅ Original Edge Linking:');
    console.log('   ID:', updatedOriginalEdge.id);
    console.log('   supersededBy:', updatedOriginalEdge.supersededBy);
    console.log('   Status:', updatedOriginalEdge.status);

    // Verify the linking is bidirectional
    expect(newEdge.supersedes).toBe(updatedOriginalEdge.id);
    expect(updatedOriginalEdge.supersededBy).toBe(newEdge.id);

    console.log('\n✅ Piece 3: Automatic Linking Test PASSED');
    console.log('   Operator declared new edge with only reassessmentSessionId');
    console.log('   System automatically set supersedes and supersededBy');
    console.log('   NO manual edge ID entry needed by operator');
    console.log('   Link is bidirectional and verified');
  });

  it('rejects declaration from nonexistent reassessment session', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    // Try to declare with nonexistent reassessment session
    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-link-invalid',
        fromNodeId: 'some-source',
        toNodeId: 'some-dest',
        gives: 'test',
        name: 'Invalid Test',
        targetDate: '2026-09-15',
        reassessmentSessionId: 'nonexistent-session-id', // Doesn't exist
      },
    });

    expect(state.lastPlanError?.code).toBe('REASSESSMENT_SESSION_NOT_FOUND');

    console.log('✅ Nonexistent Session Rejection Test PASSED:');
    console.log('   Error code:', state.lastPlanError?.code);
  });
});

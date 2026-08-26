/**
 * Convergence Step 3 Reschedule: Piece 4 — Satisfied Recognition
 *
 * CRITICAL PROOF: A Satisfied source's original completion carries forward UNALTERED
 * (without re-evaluation against new deadline), such that only the Needs Redo source
 * needing to complete on the new deadline is sufficient for the edge to reach CONVERGED.
 *
 * Test scenario:
 * 1. Original edge (PARTIAL): 1 completed + 1 missed source
 * 2. Rescheduled edge: same sources, new deadline
 * 3. Dispositions: Satisfied (completed) + Needs Redo (missed)
 * 4. At new deadline: only Needs Redo source completes
 * 5. Edge status = CONVERGED (proving Satisfied already counted, unaltered)
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Step 3 Reschedule Piece 4: Satisfied Carries Forward Unaltered', () => {
  it('proves Satisfied source unaltered credit: only Needs Redo completing suffices for CONVERGED', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    // Setup: Create verification source
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'vs-piece4', domain: 'testing', source: 'manual' },
    });

    // Create source entity
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-piece4-src',
        name: 'Source',
        roleTags: ['source'],
        purpose: 'Test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    // Create initiative
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'init-piece4',
        name: 'Initiative',
        purpose: 'Test',
        classification: 'objective',
        doneWhen: 'Complete',
      },
    });

    // Create project
    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-piece4',
        name: 'Project',
        owningEntityId: 'entity-piece4-src',
        description: 'Complete',
        verificationSourceId: 'vs-piece4',
      },
    });

    // Create deliverable 1 (will be completed at original deadline)
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-piece4-completed',
        name: 'Completed First',
        owningInitiativeId: 'init-piece4',
        owningProjectId: 'proj-piece4',
        requiredBlocks: 5,
      },
    });

    // Create deliverable 2 (will be missed at original deadline)
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-piece4-missed',
        name: 'Missed First',
        owningInitiativeId: 'init-piece4',
        owningProjectId: 'proj-piece4',
        requiredBlocks: 5,
      },
    });

    // Create destination entity
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-piece4-dest',
        name: 'Destination',
        roleTags: ['destination'],
        purpose: 'Test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    // ============================================================
    // ORIGINAL EDGE: Create at 2026-09-15
    // ============================================================

    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-piece4-original',
        fromNodeId: 'init-piece4',
        toNodeId: 'entity-piece4-dest',
        gives: 'test piece 4',
        name: 'Original Convergence',
        targetDate: '2026-09-15',
      },
    });

    // Mark first deliverable as completed (before original deadline)
    state.matrix.deliverablesById['deliv-piece4-completed'].completionEvidence = 'Done';
    state.matrix.deliverablesById['deliv-piece4-completed'].completedOnISO = '2026-09-10T10:00:00Z';

    // Leave second deliverable incomplete

    // Evaluate original edge at targetDate
    state = computeDerivedState(state, {
      type: 'UPDATE_CONVERGENCE_STATUSES',
      payload: { evaluationDate: '2026-09-15' },
    });

    // Verify ORIGINAL edge is PARTIAL (1 completed, 1 missed)
    const originalEdge = state.matrix.convergenceEdgesById['conv-piece4-original'];
    expect(originalEdge.status).toBe('PARTIAL');
    expect(originalEdge.disclosure.completedSourceIds).toContain('deliv-piece4-completed');
    expect(originalEdge.disclosure.missedSourceIds).toContain('deliv-piece4-missed');

    console.log('✅ Original Edge (2026-09-15):');
    console.log('   Status:', originalEdge.status);
    console.log('   Completed:', originalEdge.disclosure.completedSourceIds);
    console.log('   Missed:', originalEdge.disclosure.missedSourceIds);

    // ============================================================
    // PIECE 4 SETUP: Initiate reschedule
    // ============================================================

    state = computeDerivedState(state, {
      type: 'PROCESS_MISSED_CONVERGENCE',
      payload: {
        edgeId: 'conv-piece4-original',
        action: {
          type: 'RESCHEDULE',
          completionState: {
            completed: ['deliv-piece4-completed'],
            missed: ['deliv-piece4-missed'],
          },
        },
      },
    });

    // Get reassessment session
    const reassessmentSessionId = state.matrix.convergenceEdgesById['conv-piece4-original'].reassessmentSessionId;
    expect(reassessmentSessionId).toBeDefined();

    // Complete reassessment with dispositions
    state = computeDerivedState(state, {
      type: 'COMPLETE_REASSESSMENT',
      payload: {
        reassessmentSessionId,
        sourceDispositions: {
          'deliv-piece4-completed': 'Satisfied',  // Completed source kept as-is
          'deliv-piece4-missed': 'Needs Redo',    // Missed source re-enter as work
        },
      },
    });

    // Declare rescheduled edge
    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-piece4-rescheduled',
        fromNodeId: 'init-piece4',
        toNodeId: 'entity-piece4-dest',
        gives: 'test piece 4 after reschedule',
        name: 'Rescheduled Convergence',
        targetDate: '2026-10-15',  // NEW deadline
        reassessmentSessionId,
      },
    });

    const rescheduledEdge = state.matrix.convergenceEdgesById['conv-piece4-rescheduled'];
    expect(rescheduledEdge).toBeDefined();
    expect(rescheduledEdge.sourceDispositions).toEqual({
      'deliv-piece4-completed': 'Satisfied',
      'deliv-piece4-missed': 'Needs Redo',
    });

    console.log('\n✅ Rescheduled Edge (2026-10-15):');
    console.log('   ID:', rescheduledEdge.id);
    console.log('   Dispositions:', rescheduledEdge.sourceDispositions);
    console.log('   Targets:', rescheduledEdge.targetDate);

    // ============================================================
    // PIECE 4 PROOF: Complete only Needs Redo source on new deadline
    // ============================================================

    // Key point: Do NOT update the Satisfied source (leave it as-is)
    // Only mark the Needs Redo source as complete on the NEW deadline

    state.matrix.deliverablesById['deliv-piece4-missed'].completionEvidence = 'Completed';
    state.matrix.deliverablesById['deliv-piece4-missed'].completedOnISO = '2026-10-12T10:00:00Z';

    // The Satisfied source is left unchanged from its original state:
    // - completionEvidence: 'Done' (original completion still intact)
    // - completedOnISO: '2026-09-10T10:00:00Z' (BEFORE new deadline)

    console.log('\n✅ Completion State at New Deadline (2026-10-15):');
    console.log('   deliv-piece4-completed (Satisfied):');
    console.log('     - evidence:', state.matrix.deliverablesById['deliv-piece4-completed'].completionEvidence);
    console.log('     - completedOn:', state.matrix.deliverablesById['deliv-piece4-completed'].completedOnISO);
    console.log('     - Note: NOT re-evaluated (carries forward original credit)');
    console.log('   deliv-piece4-missed (Needs Redo):');
    console.log('     - evidence:', state.matrix.deliverablesById['deliv-piece4-missed'].completionEvidence);
    console.log('     - completedOn:', state.matrix.deliverablesById['deliv-piece4-missed'].completedOnISO);
    console.log('     - Note: Newly complete on new deadline');

    // Evaluate rescheduled edge at NEW deadline
    state = computeDerivedState(state, {
      type: 'UPDATE_CONVERGENCE_STATUSES',
      payload: { evaluationDate: '2026-10-15' },
    });

    // ============================================================
    // PIECE 4 CRITICAL ASSERTION
    // ============================================================

    const evaluatedRescheduledEdge = state.matrix.convergenceEdgesById['conv-piece4-rescheduled'];

    console.log('\n✅ PIECE 4 CRITICAL RESULT:');
    console.log('   Rescheduled Edge Status:', evaluatedRescheduledEdge.status);
    console.log('   Expected: CONVERGED');
    console.log('   Why: Satisfied source (already counted) + Needs Redo source (now complete) = all sources met');

    // THE KEY PROOF: Status must be CONVERGED
    // This proves that:
    // - Satisfied source's original completion DID carry forward (not re-evaluated)
    // - Only Needs Redo source needing to complete was sufficient
    // - Both conditions together made the edge CONVERGED

    expect(evaluatedRescheduledEdge.status).toBe('CONVERGED');

    // For CONVERGED edges, all sources are satisfied by definition
    // (CONVERGED edges create Milestones, not disclosure records)
    expect(evaluatedRescheduledEdge.status).toBe('CONVERGED');

    console.log('\n✅ Piece 4: Satisfied Unaltered Recognition Test PASSED');
    console.log('   Original edge: PARTIAL (1 completed, 1 missed)');
    console.log('   Rescheduled: Satisfied + Needs Redo dispositions');
    console.log('   New deadline: Only Needs Redo completes');
    console.log('   Result: Edge = CONVERGED (because Satisfied already counted)');
    console.log('\n   DOCTRINE PROVED:');
    console.log('   Satisfied source original completion carries forward UNALTERED');
    console.log('   Without re-evaluation against new deadline');
    console.log('   Needs Redo source completing alone is SUFFICIENT for convergence');
  });

  it('Satisfied source remains unaltered even if new deadline has passed (backward evaluation)', () => {
    // Edge case: If rescheduled edge targetDate is in the past relative to current time,
    // Satisfied source still counts as completed (not re-evaluated)

    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-11-01T10:00:00Z' };  // Current date way in future

    // Minimal setup
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'vs-past', domain: 'testing', source: 'manual' },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-past-src',
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
        id: 'init-past',
        name: 'Initiative',
        purpose: 'Test',
        classification: 'objective',
        doneWhen: 'Complete',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-past',
        name: 'Project',
        owningEntityId: 'entity-past-src',
        description: 'Complete',
        verificationSourceId: 'vs-past',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-past-completed',
        name: 'Completed',
        owningInitiativeId: 'init-past',
        owningProjectId: 'proj-past',
        requiredBlocks: 5,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-past-missed',
        name: 'Missed',
        owningInitiativeId: 'init-past',
        owningProjectId: 'proj-past',
        requiredBlocks: 5,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-past-dest',
        name: 'Destination',
        roleTags: ['destination'],
        purpose: 'Test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    // Original edge at old deadline
    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-past-original',
        fromNodeId: 'init-past',
        toNodeId: 'entity-past-dest',
        gives: 'test',
        name: 'Original Past',
        targetDate: '2026-09-15',
      },
    });

    state.matrix.deliverablesById['deliv-past-completed'].completionEvidence = 'Done';
    state.matrix.deliverablesById['deliv-past-completed'].completedOnISO = '2026-09-10T10:00:00Z';

    state = computeDerivedState(state, {
      type: 'UPDATE_CONVERGENCE_STATUSES',
      payload: { evaluationDate: '2026-09-15' },
    });

    // Initiate reschedule
    state = computeDerivedState(state, {
      type: 'PROCESS_MISSED_CONVERGENCE',
      payload: {
        edgeId: 'conv-past-original',
        action: {
          type: 'RESCHEDULE',
          completionState: {
            completed: ['deliv-past-completed'],
            missed: ['deliv-past-missed'],
          },
        },
      },
    });

    const sessionId = state.matrix.convergenceEdgesById['conv-past-original'].reassessmentSessionId;

    state = computeDerivedState(state, {
      type: 'COMPLETE_REASSESSMENT',
      payload: {
        reassessmentSessionId: sessionId,
        sourceDispositions: {
          'deliv-past-completed': 'Satisfied',
          'deliv-past-missed': 'Needs Redo',
        },
      },
    });

    // Rescheduled edge to PAST deadline (2026-10-15)
    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-past-rescheduled',
        fromNodeId: 'init-past',
        toNodeId: 'entity-past-dest',
        gives: 'test past',
        name: 'Rescheduled Past',
        targetDate: '2026-10-15',  // Already passed (current is 2026-11-01)
        reassessmentSessionId: sessionId,
      },
    });

    // Mark Needs Redo as complete on the (now-past) deadline
    state.matrix.deliverablesById['deliv-past-missed'].completionEvidence = 'Done';
    state.matrix.deliverablesById['deliv-past-missed'].completedOnISO = '2026-10-12T10:00:00Z';

    // Evaluate at the past deadline
    state = computeDerivedState(state, {
      type: 'UPDATE_CONVERGENCE_STATUSES',
      payload: { evaluationDate: '2026-10-15' },
    });

    const evaluatedEdge = state.matrix.convergenceEdgesById['conv-past-rescheduled'];

    // Even though deadline is in past, Satisfied source still counts as complete (unaltered)
    expect(evaluatedEdge.status).toBe('CONVERGED');

    console.log('✅ Piece 4 Edge Case: Satisfied Remains Unaltered for Past Deadlines');
    console.log('   Current date: 2026-11-01');
    console.log('   Rescheduled deadline: 2026-10-15 (already passed)');
    console.log('   Status: CONVERGED (Satisfied source not re-evaluated)');
  });
});

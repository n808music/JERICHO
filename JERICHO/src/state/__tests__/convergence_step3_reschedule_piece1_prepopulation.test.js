/**
 * Convergence Step 3 Reschedule: Piece 1 — Reassessment Session Pre-Population
 *
 * Verifies that when reschedule is initiated on a PARTIAL edge,
 * the reassessment session correctly pre-populates ALL sources
 * (both completed and missed) for operator review.
 *
 * This is the foundation for per-source disposition assignment (Piece 2).
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Step 3 Reschedule Piece 1: Pre-Population of Sources', () => {
  it('pre-populates reassessment session with both completed and missed sources from PARTIAL edge', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    // Setup: Create verification source
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-prepop',
        domain: 'testing',
        source: 'manual_verification',
      },
    });

    // Create source entity
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-prepop',
        name: 'Source Entity',
        roleTags: ['source'],
        purpose: 'Pre-population test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    // Create initiative
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'init-prepop',
        name: 'Pre-Population Initiative',
        purpose: 'Test pre-population',
        classification: 'objective',
        doneWhen: 'All complete',
      },
    });

    // Create project
    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-prepop',
        name: 'Pre-Population Project',
        owningEntityId: 'entity-prepop',
        successMetric: 'Complete',
        verificationSourceId: 'vs-prepop',
      },
    });

    // Create deliverable 1 (will complete)
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-prepop-completed',
        name: 'Completed Deliverable',
        owningInitiativeId: 'init-prepop',
        owningProjectId: 'proj-prepop',
        requiredBlocks: 5,
      },
    });

    // Create deliverable 2 (will NOT complete)
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-prepop-missed',
        name: 'Missed Deliverable',
        owningInitiativeId: 'init-prepop',
        owningProjectId: 'proj-prepop',
        requiredBlocks: 5,
      },
    });

    // Create destination
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-dest-prepop',
        name: 'Destination',
        roleTags: ['destination'],
        purpose: 'Test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    // Declare convergence edge with both deliverables as sources
    const targetDate = '2026-09-15';
    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-prepop',
        fromNodeId: 'init-prepop',
        toNodeId: 'entity-dest-prepop',
        gives: 'pre-population test',
        name: 'Pre-Population Test Edge',
        targetDate,
      },
    });

    // Mark deliverable 1 as completed
    state.matrix.deliverablesById['deliv-prepop-completed'].completionEvidence = 'Done';
    state.matrix.deliverablesById['deliv-prepop-completed'].completedOnISO = '2026-09-10T15:30:00Z';
    // deliverable 2 remains incomplete

    // Evaluate at targetDate to create PARTIAL status
    state = computeDerivedState(state, {
      type: 'UPDATE_CONVERGENCE_STATUSES',
      payload: {
        evaluationDate: targetDate,
      },
    });

    // Verify edge is PARTIAL
    const edge = state.matrix.convergenceEdgesById['conv-prepop'];
    expect(edge.status).toBe('PARTIAL');
    expect(edge.disclosure.completedSourceIds).toContain('deliv-prepop-completed');
    expect(edge.disclosure.missedSourceIds).toContain('deliv-prepop-missed');

    // ============================================================
    // PIECE 1 TEST: Initiate reschedule and verify pre-population
    // ============================================================

    state = computeDerivedState(state, {
      type: 'PROCESS_MISSED_CONVERGENCE',
      payload: {
        edgeId: 'conv-prepop',
        action: {
          type: 'RESCHEDULE',
          completionState: {
            completed: ['deliv-prepop-completed'],
            missed: ['deliv-prepop-missed'],
          },
          reason: 'Rescheduling partial convergence',
        },
      },
    });

    // Debug: Check for errors
    if (state.lastPlanError) {
      console.error('Error during reschedule:', state.lastPlanError);
    }

    // Re-fetch the edge from state (it's been cloned during computeDerivedState)
    const updatedEdge = state.matrix.convergenceEdgesById['conv-prepop'];
    console.log('Updated edge status:', updatedEdge.status);
    console.log('Updated edge reassessmentSessionId:', updatedEdge.reassessmentSessionId);
    console.log('Reassessment sessions in state:', Object.keys(state.reassessmentSessions || {}));

    // CRITICAL VERIFICATION: Check that reassessment session exists
    expect(state.reassessmentSessions).toBeDefined();
    expect(Object.keys(state.reassessmentSessions).length).toBeGreaterThan(0);

    // Find the created reassessment session
    const reassessmentSessionId = updatedEdge.reassessmentSessionId;
    expect(reassessmentSessionId).toBeDefined();

    const reassessmentSession = state.reassessmentSessions[reassessmentSessionId];
    expect(reassessmentSession).toBeDefined();

    // ============================================================
    // PIECE 1 PROOF: Pre-Population Verification
    // ============================================================

    console.log('✅ Reassessment Session Created');
    console.log('   Session ID:', reassessmentSessionId);
    console.log('   Triggering Edge:', reassessmentSession.triggeringEdgeId);
    console.log('   Triggering Edge Name:', reassessmentSession.triggeringEdgeName);
    console.log('   Destination (toNodeId):', reassessmentSession.triggeringEdgeDestination);
    console.log('   Gives:', reassessmentSession.triggeringEdgeGives);

    // Verify pre-populated sources
    expect(reassessmentSession.prePopulatedSources).toBeDefined();
    expect(Array.isArray(reassessmentSession.prePopulatedSources)).toBe(true);
    expect(reassessmentSession.prePopulatedSources.length).toBe(2);

    // Verify COMPLETED source is pre-populated correctly
    const completedSource = reassessmentSession.prePopulatedSources.find(
      (s) => s.id === 'deliv-prepop-completed'
    );
    expect(completedSource).toBeDefined();
    expect(completedSource.priorCompletion).toBe(true);
    expect(completedSource.priorMissed).toBe(false);
    expect(completedSource.disposition).toBeNull(); // Operator hasn't assigned yet

    console.log('   ✓ Completed source pre-populated:');
    console.log('     id:', completedSource.id);
    console.log('     priorCompletion:', completedSource.priorCompletion);
    console.log('     priorMissed:', completedSource.priorMissed);

    // Verify MISSED source is pre-populated correctly
    const missedSource = reassessmentSession.prePopulatedSources.find(
      (s) => s.id === 'deliv-prepop-missed'
    );
    expect(missedSource).toBeDefined();
    expect(missedSource.priorCompletion).toBe(false);
    expect(missedSource.priorMissed).toBe(true);
    expect(missedSource.disposition).toBeNull(); // Operator hasn't assigned yet

    console.log('   ✓ Missed source pre-populated:');
    console.log('     id:', missedSource.id);
    console.log('     priorCompletion:', missedSource.priorCompletion);
    console.log('     priorMissed:', missedSource.priorMissed);

    // Verify original edge marked as awaiting reassessment
    expect(updatedEdge.reassessmentSessionId).toBe(reassessmentSessionId);
    expect(updatedEdge.status).toBe('MISSED');
    expect(updatedEdge.rescheduleSessionInitiatedAtISO).toBeDefined();

    console.log('\n✅ Piece 1: Pre-Population Test PASSED');
    console.log('   Both completed and missed sources pre-populated');
    console.log('   Operator ready to assign per-source dispositions');
  });

  it('correctly distinguishes priorCompletion vs priorMissed for each source', () => {
    // This test verifies the data structure is unambiguous:
    // - A source cannot be both priorCompletion=true AND priorMissed=true
    // - Each source has exactly one prior state

    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    // Minimal setup
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-distinguish',
        domain: 'testing',
        source: 'manual',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-distinguish',
        name: 'Entity',
        roleTags: ['source'],
        purpose: 'Test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'init-distinguish',
        name: 'Initiative',
        purpose: 'Test',
        classification: 'objective',
        doneWhen: 'Complete',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-distinguish',
        name: 'Project',
        owningEntityId: 'entity-distinguish',
        successMetric: 'Complete',
        verificationSourceId: 'vs-distinguish',
      },
    });

    // Create 3 deliverables: one completed, one missed, one halfway
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-complete',
        name: 'Complete',
        owningInitiativeId: 'init-distinguish',
        owningProjectId: 'proj-distinguish',
        requiredBlocks: 5,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-missed',
        name: 'Missed',
        owningInitiativeId: 'init-distinguish',
        owningProjectId: 'proj-distinguish',
        requiredBlocks: 5,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-dest-distinguish',
        name: 'Destination',
        roleTags: ['destination'],
        purpose: 'Test',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    // Declare convergence
    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-distinguish',
        fromNodeId: 'init-distinguish',
        toNodeId: 'entity-dest-distinguish',
        gives: 'test',
        name: 'Distinguish Test',
        targetDate: '2026-09-15',
      },
    });

    // Complete one, leave one incomplete
    state.matrix.deliverablesById['deliv-complete'].completionEvidence = 'Done';
    state.matrix.deliverablesById['deliv-complete'].completedOnISO = '2026-09-10T10:00:00Z';

    // Evaluate
    state = computeDerivedState(state, {
      type: 'UPDATE_CONVERGENCE_STATUSES',
      payload: {
        evaluationDate: '2026-09-15',
      },
    });

    // Initiate reschedule
    state = computeDerivedState(state, {
      type: 'PROCESS_MISSED_CONVERGENCE',
      payload: {
        edgeId: 'conv-distinguish',
        action: {
          type: 'RESCHEDULE',
          completionState: {
            completed: ['deliv-complete'],
            missed: ['deliv-missed'],
          },
        },
      },
    });

    const sessionId = state.matrix.convergenceEdgesById['conv-distinguish'].reassessmentSessionId;
    const session = state.reassessmentSessions[sessionId];

    // Verify mutual exclusivity
    for (const source of session.prePopulatedSources) {
      // Each source has exactly one prior state (not both, not neither)
      const hasCompletion = source.priorCompletion === true;
      const hasMissed = source.priorMissed === true;
      const exclusivity = (hasCompletion && !hasMissed) || (!hasCompletion && hasMissed);

      expect(exclusivity).toBe(true);
      console.log(`✓ ${source.id}: priorCompletion=${source.priorCompletion}, priorMissed=${source.priorMissed}`);
    }

    console.log('\n✅ Piece 1: Distinction Test PASSED');
    console.log('   Each source has exactly one prior state (completion XOR missed)');
  });
});

/**
 * Convergence Step 4: Status Computation and Reschedule Logic
 *
 * Tests three branches:
 * 1. CONVERGED: All sources completed → writes Milestone
 * 2. PARTIAL: Some sources completed → surfaces per-source disclosure
 * 3. MISSED: Deadline passed → routes to reschedule/close decision
 *    - Reschedule: operator re-declares through Step 3 (sources re-confirmed)
 *    - Close: HARD BLOCKS until all sources have explicit disposition
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Convergence Step 4: Status Computation', () => {
  describe('CONVERGED: All sources completed on time', () => {
    it('computes status as CONVERGED and writes Milestone record', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

      // Create verification source
      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: {
          id: 'vs-converged',
          domain: 'testing',
          source: 'manual_verification',
        },
      });

      // Create source entity
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-src-conv',
          name: 'Source Entity',
          roleTags: ['source'],
          purpose: 'Source entity',
          formationState: 'founded',
          statusEvidence: 'Active',
        },
      });

      // Create source initiative
      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-converged',
          name: 'Converged Initiative',
          purpose: 'Complete convergence test',
          classification: 'objective',
          doneWhen: 'All deliverables done',
        },
      });

      // Create project (required for deliverables)
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'proj-conv',
          name: 'Convergence Project',
          owningEntityId: 'entity-src-conv',
          description: 'Deliverables complete',
          verificationSourceId: 'vs-converged',
        },
      });

      // Create deliverable 1 (will complete)
      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliv-conv-1',
          name: 'Deliverable 1',
          owningInitiativeId: 'init-converged',
          owningProjectId: 'proj-conv',
          requiredBlocks: 5,
        },
      });

      // Create deliverable 2 (will complete)
      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliv-conv-2',
          name: 'Deliverable 2',
          owningInitiativeId: 'init-converged',
          owningProjectId: 'proj-conv',
          requiredBlocks: 5,
        },
      });

      // Create destination entity
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-dest-conv',
          name: 'Destination',
          roleTags: ['destination'],
          purpose: 'Receive convergence',
          formationState: 'founded',
          statusEvidence: 'Active',
        },
      });

      // Declare convergence edge
      const targetDate = '2026-09-15';
      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-converged',
          fromNodeId: 'init-converged',
          toNodeId: 'entity-dest-conv',
          gives: 'convergence of work',
          name: 'Convergence Test',
          targetDate,
        },
      });

      const edge = state.matrix.convergenceEdgesById['conv-converged'];
      expect(edge).toBeDefined();
      expect(edge.status).toBe('PENDING');

      // Simulate completion of deliverables BEFORE targetDate
      const completionDate = '2026-09-10'; // Before 2026-09-15
      state.matrix.deliverablesById['deliv-conv-1'].completionEvidence = 'Done';
      state.matrix.deliverablesById['deliv-conv-1'].completedOnISO = `${completionDate}T15:30:00Z`;
      state.matrix.deliverablesById['deliv-conv-2'].completionEvidence = 'Done';
      state.matrix.deliverablesById['deliv-conv-2'].completedOnISO = `${completionDate}T16:00:00Z`;

      // Evaluate convergence at targetDate
      state = computeDerivedState(state, {
        type: 'UPDATE_CONVERGENCE_STATUSES',
        payload: {
          evaluationDate: targetDate,
        },
      });

      // Verify status changed to CONVERGED
      const evaluatedEdge = state.matrix.convergenceEdgesById['conv-converged'];
      expect(evaluatedEdge.status).toBe('CONVERGED');

      // Verify Milestone was created
      const milestones = Object.values(state.matrix.milestonesById || {}).filter(
        (m) => m.convergenceEdgeId === 'conv-converged'
      );
      expect(milestones.length).toBeGreaterThan(0);
      const milestone = milestones[0];
      expect(milestone.name).toContain('Converged');
      expect(milestone.date).toBe(targetDate);
      expect(milestone.laneIds).toContain('deliv-conv-1');
      expect(milestone.laneIds).toContain('deliv-conv-2');

      console.log('✅ CONVERGED Branch Test PASSED:');
      console.log('   - Edge status: PENDING → CONVERGED');
      console.log('   - Milestone created:', milestone.name);
      console.log('   - Lanes included:', milestone.laneIds);
    });
  });

  describe('PARTIAL: Some sources completed, some missed', () => {
    it('computes status as PARTIAL and surfaces per-source disclosure', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

      // Create verification source
      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: {
          id: 'vs-partial',
          domain: 'testing',
          source: 'manual_verification',
        },
      });

      // Create source entity
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-src-partial',
          name: 'Source Entity',
          roleTags: ['source'],
          purpose: 'Source entity',
          formationState: 'founded',
          statusEvidence: 'Active',
        },
      });

      // Create source initiative
      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-partial',
          name: 'Partial Initiative',
          purpose: 'Partial completion test',
          classification: 'objective',
          doneWhen: 'Some done',
        },
      });

      // Create project (required for deliverables)
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'proj-partial',
          name: 'Partial Project',
          owningEntityId: 'entity-src-partial',
          description: 'Some deliverables complete',
          verificationSourceId: 'vs-partial',
        },
      });

      // Create deliverable 1 (will complete)
      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliv-part-1',
          name: 'Completed Deliverable',
          owningInitiativeId: 'init-partial',
          owningProjectId: 'proj-partial',
          requiredBlocks: 5,
        },
      });

      // Create deliverable 2 (will NOT complete)
      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliv-part-2',
          name: 'Incomplete Deliverable',
          owningInitiativeId: 'init-partial',
          owningProjectId: 'proj-partial',
          requiredBlocks: 5,
        },
      });

      // Create destination entity
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-dest-partial',
          name: 'Destination',
          roleTags: ['destination'],
          purpose: 'Receive convergence',
          formationState: 'founded',
          statusEvidence: 'Active',
        },
      });

      // Declare convergence edge
      const targetDate = '2026-09-15';
      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-partial',
          fromNodeId: 'init-partial',
          toNodeId: 'entity-dest-partial',
          gives: 'partial convergence',
          name: 'Partial Convergence Test',
          targetDate,
        },
      });

      // Complete only deliverable 1
      state.matrix.deliverablesById['deliv-part-1'].completionEvidence = 'Done';
      state.matrix.deliverablesById['deliv-part-1'].completedOnISO = '2026-09-10T15:30:00Z';
      // deliv-part-2 remains incomplete

      // Evaluate convergence at targetDate
      state = computeDerivedState(state, {
        type: 'UPDATE_CONVERGENCE_STATUSES',
        payload: {
          evaluationDate: targetDate,
        },
      });

      // Verify status is PARTIAL
      const evaluatedEdge = state.matrix.convergenceEdgesById['conv-partial'];
      expect(evaluatedEdge.status).toBe('PARTIAL');

      // Verify disclosure was recorded
      expect(evaluatedEdge.disclosure).toBeDefined();
      expect(evaluatedEdge.disclosure.completedSourceIds).toContain('deliv-part-1');
      expect(evaluatedEdge.disclosure.missedSourceIds).toContain('deliv-part-2');

      console.log('✅ PARTIAL Branch Test PASSED:');
      console.log('   - Edge status: PENDING → PARTIAL');
      console.log('   - Completed sources:', evaluatedEdge.disclosure.completedSourceIds);
      console.log('   - Missed sources:', evaluatedEdge.disclosure.missedSourceIds);
    });
  });

  describe('MISSED: Deadline passed without completion', () => {
    it('routes MISSED edge to reschedule (operator re-declares sources)', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

      // Create verification source
      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: {
          id: 'vs-missed',
          domain: 'testing',
          source: 'manual_verification',
        },
      });

      // Create source entity
      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-missed',
          name: 'Missed Initiative',
          purpose: 'Missed deadline test',
          classification: 'objective',
          doneWhen: 'All complete',
        },
      });

      // Create destination entity
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-dest-missed',
          name: 'Destination',
          roleTags: ['destination'],
          purpose: 'Receive convergence',
          formationState: 'founded',
          statusEvidence: 'Active',
        },
      });

      // Declare convergence edge
      const originalTargetDate = '2026-09-15';
      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-missed',
          fromNodeId: 'init-missed',
          toNodeId: 'entity-dest-missed',
          gives: 'missed convergence',
          name: 'Missed Convergence Test',
          targetDate: originalTargetDate,
        },
      });

      // Evaluate convergence at targetDate (no sources complete)
      state = computeDerivedState(state, {
        type: 'UPDATE_CONVERGENCE_STATUSES',
        payload: {
          evaluationDate: originalTargetDate,
        },
      });

      // Verify status is MISSED
      const missedEdge = state.matrix.convergenceEdgesById['conv-missed'];
      expect(missedEdge.status).toBe('MISSED');

      // Now reschedule: mark edge as ready for re-declaration
      // Reschedule does NOT auto-create a new edge; operator re-declares through Step 3
      state = computeDerivedState(state, {
        type: 'PROCESS_MISSED_CONVERGENCE',
        payload: {
          edgeId: 'conv-missed',
          action: {
            type: 'RESCHEDULE',
            reason: 'Delayed work, rescheduling',
          },
        },
      });

      // Verify original edge marked as ready for reschedule
      const rescheduledEdge = state.matrix.convergenceEdgesById['conv-missed'];
      expect(rescheduledEdge.status).toBe('MISSED');
      expect(rescheduledEdge.rescheduleReason).toBe('Delayed work, rescheduling');
      expect(rescheduledEdge.rescheduleSessionInitiatedAtISO).toBeDefined();

      // Key doctrine point: NO new edge auto-created
      // Operator must re-declare through Step 3, with opportunity to modify sources
      expect(rescheduledEdge.supersededBy).toBeNull();

      console.log('✅ MISSED→RESCHEDULE Branch Test PASSED:');
      console.log('   - Edge marked for reschedule (no auto-new edge)');
      console.log('   - Reschedule reason recorded:', rescheduledEdge.rescheduleReason);
      console.log('   - Operator re-declares through Step 3 with source re-confirmation');
    });

    it('HARD BLOCKS close of multi-source edge without all dispositions', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

      // Setup: MULTI-SOURCE convergence edge (the critical test case)
      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: {
          id: 'vs-multi',
          domain: 'testing',
          source: 'manual_verification',
        },
      });

      // Create entity for projects
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-multi-src',
          name: 'Source Entity',
          roleTags: ['source'],
          purpose: 'Multi-source',
          formationState: 'founded',
          statusEvidence: 'Active',
        },
      });

      // Create projects for deliverables
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'proj-multi-1',
          name: 'Project 1',
          owningEntityId: 'entity-multi-src',
          description: 'Complete',
          verificationSourceId: 'vs-multi',
        },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'proj-multi-2',
          name: 'Project 2',
          owningEntityId: 'entity-multi-src',
          description: 'Complete',
          verificationSourceId: 'vs-multi',
        },
      });

      // Two sources: init1 and init2
      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-multi-1',
          name: 'Initiative 1',
          purpose: 'Multi-source test',
          classification: 'objective',
          doneWhen: 'Complete',
        },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-multi-2',
          name: 'Initiative 2',
          purpose: 'Multi-source test',
          classification: 'objective',
          doneWhen: 'Complete',
        },
      });

      // Create deliverables owned by each initiative
      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliv-multi-1',
          name: 'Deliverable 1',
          owningInitiativeId: 'init-multi-1',
          owningProjectId: 'proj-multi-1',
          requiredBlocks: 5,
        },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliv-multi-2',
          name: 'Deliverable 2',
          owningInitiativeId: 'init-multi-2',
          owningProjectId: 'proj-multi-2',
          requiredBlocks: 5,
        },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-dest-multi',
          name: 'Destination',
          roleTags: ['destination'],
          purpose: 'Receive convergence',
          formationState: 'founded',
          statusEvidence: 'Active',
        },
      });

      // Declare convergence with TWO sources
      const targetDate = '2026-09-15';
      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-multi',
          fromNodeIds: ['init-multi-1', 'init-multi-2'], // TWO SOURCES
          toNodeId: 'entity-dest-multi',
          gives: 'multi-source convergence',
          name: 'Multi-Source Convergence',
          targetDate,
        },
      });

      // Evaluate: both sources missed
      state = computeDerivedState(state, {
        type: 'UPDATE_CONVERGENCE_STATUSES',
        payload: {
          evaluationDate: targetDate,
        },
      });

      const missedEdge = state.matrix.convergenceEdgesById['conv-multi'];
      expect(missedEdge.status).toBe('MISSED');

      // DOCTRINE HARD BLOCK TEST:
      // Attempt to close WITHOUT providing dispositions for all sources
      state = computeDerivedState(state, {
        type: 'PROCESS_MISSED_CONVERGENCE',
        payload: {
          edgeId: 'conv-multi',
          action: {
            type: 'CLOSE',
            reason: 'Abandoning convergence',
            sourceDispositions: {
              // ONLY disposed init-multi-1, omitting init-multi-2
              'init-multi-1': 'abandoned',
            },
          },
        },
      });

      // CRITICAL: Close should be REJECTED
      expect(state.lastPlanError?.code).toBe('CLOSE_MISSING_SOURCE_DISPOSITIONS');
      // Undisposed sources are the deliverables (which were walked from the initiatives)
      expect(state.lastPlanError?.meta?.undisposedSources).toContain('deliv-multi-2');
      expect(state.matrix.convergenceEdgesById['conv-multi'].status).toBe('MISSED'); // Still MISSED, not closed

      console.log('✅ Multi-Source HARD BLOCK Test PASSED:');
      console.log('   - Attempted to close without all source dispositions');
      console.log('   - Error code:', state.lastPlanError?.code);
      console.log('   - Undisposed sources:', state.lastPlanError?.meta?.undisposedSources);
      console.log('   - Edge remains MISSED (close rejected)');

      // Clear error state before retry
      state.lastPlanError = null;

      // Now close properly: provide ALL source dispositions (for deliverables)
      state = computeDerivedState(state, {
        type: 'PROCESS_MISSED_CONVERGENCE',
        payload: {
          edgeId: 'conv-multi',
          action: {
            type: 'CLOSE',
            reason: 'All sources abandoned',
            sourceDispositions: {
              'deliv-multi-1': 'abandoned',
              'deliv-multi-2': 'abandoned', // ALL sources now disposed
            },
          },
        },
      });

      // Now close succeeds
      if (state.lastPlanError) {
        console.error('Unexpected error on second close attempt:', state.lastPlanError);
      }
      expect(state.lastPlanError).toBeNull();
      const closedEdge = state.matrix.convergenceEdgesById['conv-multi'];
      expect(closedEdge.status).toBe('MISSED');
      expect(closedEdge.closureReason).toBe('All sources abandoned');
      expect(closedEdge.sourceDispositions).toEqual({
        'deliv-multi-1': 'abandoned',
        'deliv-multi-2': 'abandoned',
      });

      console.log('✅ Multi-Source CLOSE With All Dispositions Test PASSED:');
      console.log('   - Close succeeded after all source dispositions provided');
      console.log('   - Closure reason recorded:', closedEdge.closureReason);
    });
  });

  describe('Status computation edge cases', () => {
    it('remains PENDING if evaluation date is before targetDate', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

      // Setup minimal convergence
      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: {
          id: 'vs-early',
          domain: 'testing',
          source: 'manual_verification',
        },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-early',
          name: 'Early Initiative',
          purpose: 'Test',
          classification: 'objective',
          doneWhen: 'Complete',
        },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-early',
          name: 'Destination',
          roleTags: ['destination'],
          purpose: 'Test',
          formationState: 'founded',
          statusEvidence: 'Active',
        },
      });

      const targetDate = '2026-09-15';
      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-early',
          fromNodeId: 'init-early',
          toNodeId: 'entity-early',
          gives: 'early test',
          name: 'Early Test',
          targetDate,
        },
      });

      // Evaluate BEFORE targetDate
      state = computeDerivedState(state, {
        type: 'UPDATE_CONVERGENCE_STATUSES',
        payload: {
          evaluationDate: '2026-09-14', // Before targetDate
        },
      });

      // Status should remain PENDING
      const edge = state.matrix.convergenceEdgesById['conv-early'];
      expect(edge.status).toBe('PENDING');

      console.log('✅ Early Evaluation Test PASSED:');
      console.log('   - Status remains PENDING when evaluated before targetDate');
    });

    it('returns error for MISSED edge without action', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

      // Minimal setup
      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: {
          id: 'vs-noaction',
          domain: 'testing',
          source: 'manual_verification',
        },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-noaction',
          name: 'No Action Initiative',
          purpose: 'Test',
          classification: 'objective',
          doneWhen: 'Complete',
        },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-noaction',
          name: 'Destination',
          roleTags: ['destination'],
          purpose: 'Test',
          formationState: 'founded',
          statusEvidence: 'Active',
        },
      });

      const targetDate = '2026-09-15';
      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-noaction',
          fromNodeId: 'init-noaction',
          toNodeId: 'entity-noaction',
          gives: 'no action test',
          name: 'No Action Test',
          targetDate,
        },
      });

      // Mark as MISSED
      state = computeDerivedState(state, {
        type: 'UPDATE_CONVERGENCE_STATUSES',
        payload: {
          evaluationDate: targetDate,
        },
      });

      // Try to process without action type
      state = computeDerivedState(state, {
        type: 'PROCESS_MISSED_CONVERGENCE',
        payload: {
          edgeId: 'conv-noaction',
          action: {}, // No type specified
        },
      });

      // Verify error
      expect(state.lastPlanError?.code).toBe('MISSED_EDGE_NO_ACTION');
      expect(state.lastPlanError?.meta?.edgeId).toBe('conv-noaction');

      console.log('✅ No Action Error Test PASSED:');
      console.log('   - Error code:', state.lastPlanError?.code);
      console.log('   - Error reason:', state.lastPlanError?.reason);
    });
  });
});

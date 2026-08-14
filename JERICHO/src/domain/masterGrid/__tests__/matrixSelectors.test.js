/**
 * Matrix Selectors — Derived Relationships Tests
 *
 * Verify that derived selectors compute relationships correctly
 * without storing them (reverse-lookup pattern).
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../state/identityStore.js';
import { computeDerivedState } from '../../../state/identityCompute.js';
import {
  getConvergenceOwningInitiatives,
  getProjectExecutingEntities,
  getArtifactParentDeliverables,
} from '../matrixSelectors.js';

describe('Matrix Selectors — Derived Relationships', () => {
  describe('getConvergenceOwningInitiatives', () => {
    it('derives owning initiatives from convergence sources (Project owners)', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup: Entity → Initiative → Project → Convergence
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e1', name: 'Owner', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: { id: 'vs1', domain: 'testing', source: 'manual' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: { id: 'i1', name: 'Initiative', purpose: 'Test', classification: 'objective', doneWhen: 'Complete' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: { id: 'p1', name: 'Project 1', owningEntityId: 'e1', owningInitiativeId: 'i1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      // Create convergence with Project as source
      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv1',
          fromNodeId: 'p1',
          toNodeId: 'e1',
          gives: 'test',
          name: 'Test Convergence',
          targetDate: '2026-09-15',
        },
      });

      const convergence = state.matrix.convergenceEdgesById['conv1'];
      const owningInitiatives = getConvergenceOwningInitiatives(convergence, state.matrix);

      expect(owningInitiatives).toContain('i1');
      expect(owningInitiatives.length).toBe(1);
    });

    it('derives owning initiatives when source is Initiative directly', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup: Entity → Initiative
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e1', name: 'Owner', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: { id: 'i1', name: 'Initiative', purpose: 'Test', classification: 'objective', doneWhen: 'Complete' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e2', name: 'Dest', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      // Create convergence with Initiative as source
      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv1',
          fromNodeId: 'i1',
          toNodeId: 'e2',
          gives: 'test',
          name: 'Test Convergence',
          targetDate: '2026-09-15',
        },
      });

      const convergence = state.matrix.convergenceEdgesById['conv1'];
      const owningInitiatives = getConvergenceOwningInitiatives(convergence, state.matrix);

      expect(owningInitiatives).toContain('i1');
      expect(owningInitiatives.length).toBe(1);
    });

    it('handles multiple sources from different initiatives', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup: Two initiatives with their own projects
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e1', name: 'Owner', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: { id: 'vs1', domain: 'testing', source: 'manual' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: { id: 'i1', name: 'Init 1', purpose: 'Test', classification: 'objective', doneWhen: 'Complete' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: { id: 'i2', name: 'Init 2', purpose: 'Test', classification: 'objective', doneWhen: 'Complete' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: { id: 'p1', name: 'Project 1', owningEntityId: 'e1', owningInitiativeId: 'i1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: { id: 'p2', name: 'Project 2', owningEntityId: 'e1', owningInitiativeId: 'i2', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e2', name: 'Dest', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      // Create convergence with multiple sources from different initiatives
      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv1',
          fromNodeIds: ['p1', 'p2'],
          toNodeId: 'e2',
          gives: 'test',
          name: 'Multi-Init Convergence',
          targetDate: '2026-09-15',
        },
      });

      const convergence = state.matrix.convergenceEdgesById['conv1'];
      const owningInitiatives = getConvergenceOwningInitiatives(convergence, state.matrix);

      expect(owningInitiatives).toContain('i1');
      expect(owningInitiatives).toContain('i2');
      expect(owningInitiatives.length).toBe(2);
    });

    it('returns empty array for invalid or missing edge', () => {
      const matrix = { projectsById: {}, initiativesById: {}, deliverablesById: {}, artifactsById: {} };

      expect(getConvergenceOwningInitiatives(null, matrix)).toEqual([]);
      expect(getConvergenceOwningInitiatives({}, matrix)).toEqual([]);
      expect(getConvergenceOwningInitiatives({ fromNodeIds: null }, matrix)).toEqual([]);
    });
  });

  describe('getProjectExecutingEntities', () => {
    it('derives executing entities from project deliverables', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e1', name: 'Owner', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e-exec', name: 'Executor', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: { id: 'vs1', domain: 'testing', source: 'manual' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: { id: 'i1', name: 'Init', purpose: 'Test', classification: 'objective', doneWhen: 'Complete' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: { id: 'p1', name: 'Project', owningEntityId: 'e1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      // Add deliverable with executingEntityId
      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'd1',
          name: 'Deliverable',
          owningProjectId: 'p1',
          owningInitiativeId: 'i1',
          executingEntityId: 'e-exec',
        },
      });

      const executingEntities = getProjectExecutingEntities('p1', state.matrix);

      expect(executingEntities).toContain('e-exec');
      expect(executingEntities.length).toBe(1);
    });

    it('returns empty array if project has no executing entities', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e1', name: 'Owner', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: { id: 'vs1', domain: 'testing', source: 'manual' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: { id: 'p1', name: 'Project', owningEntityId: 'e1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      const executingEntities = getProjectExecutingEntities('p1', state.matrix);

      expect(executingEntities).toEqual([]);
    });
  });

  describe('getArtifactParentDeliverables', () => {
    it('returns stored parentDeliverableIds when present', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e1', name: 'Owner', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: { id: 'vs1', domain: 'testing', source: 'manual' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: { id: 'p1', name: 'Project', owningEntityId: 'e1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'art1',
          name: 'Artifact',
          producingProjectId: 'p1',
          completionEvidence: 'Done',
          verificationSourceId: 'vs1',
          operatorAttestationMethod: 'Visual',
          parentDeliverableIds: ['d1', 'd2'],
        },
      });

      const parentDeliverables = getArtifactParentDeliverables('art1', state.matrix);

      expect(parentDeliverables).toEqual(['d1', 'd2']);
    });

    it('returns empty array when no parent deliverables', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e1', name: 'Owner', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_VERIFICATION_SOURCE',
        payload: { id: 'vs1', domain: 'testing', source: 'manual' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: { id: 'p1', name: 'Project', owningEntityId: 'e1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'art1',
          name: 'Artifact',
          producingProjectId: 'p1',
          completionEvidence: 'Done',
          verificationSourceId: 'vs1',
          operatorAttestationMethod: 'Visual',
        },
      });

      const parentDeliverables = getArtifactParentDeliverables('art1', state.matrix);

      expect(parentDeliverables).toEqual([]);
    });
  });
});

/**
 * Convergence Lifecycle Step 3: Forward Declaration Mechanism
 *
 * Tests the complete forward declaration flow:
 * 1. Name requirement
 * 2. Dependency-chain exclusion check (hard block on sequential sources)
 * 3. Deliverable/Artifact walkdown
 * 4. TargetDate assignment
 * 5. Edge schema with new fields
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildBlankIdentityState, identityReducer } from '../identityStore.js';

function createEntity(state, id) {
  return identityReducer(state, {
    type: 'DECLARE_ENTITY',
    payload: {
      id,
      name: `Entity ${id}`,
      roleTags: ['sponsor'],
      purpose: 'Test entity',
      formationState: 'founded',
      statusEvidence: 'Evidence of founding',
    },
  });
}

function createInitiative(state, id, entityId) {
  return identityReducer(state, {
    type: 'DECLARE_INITIATIVE',
    payload: {
      id,
      name: `Initiative ${id}`,
      owningEntityId: entityId,
    },
  });
}

function createDeliverable(state, id, initiativeId) {
  const newState = identityReducer(state, {
    type: 'DECLARE_DELIVERABLE',
    payload: {
      id,
      name: `Deliverable ${id}`,
      owningInitiativeId: initiativeId,
      requiredBlocks: 5,
    },
  });
  if (newState.lastPlanError) {
    console.log(`Error creating deliverable ${id}:`, newState.lastPlanError);
  }
  return newState;
}

function createDependency(state, id, upstreamId, downstreamId) {
  const newState = identityReducer(state, {
    type: 'DECLARE_DEPENDENCY',
    payload: {
      id,
      upstreamId,
      downstreamId,
      type: 'hard_gate',
    },
  });
  if (newState.lastPlanError) {
    console.log(`Error creating dependency ${id}:`, newState.lastPlanError);
  }
  return newState;
}

describe('Convergence Step 3: Forward Declaration', () => {
  let state;

  beforeEach(() => {
    state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };
  });

  describe('Step 3.1: Name Requirement', () => {
    it('should reject convergence edge without name', () => {
      state = createEntity(state, 'e1');
      state = createEntity(state, 'e2');

      // Try to declare convergence without name
      state = identityReducer(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-1',
          fromNodeId: 'e1',
          toNodeId: 'e2',
          gives: 'value-prop',
          // name is missing
          targetDate: '2026-08-15',
        },
      });

      expect(state.lastPlanError?.code).toBe('CONVERGENCE_NAME_REQUIRED');
      expect(state.matrix.convergenceEdgesById['conv-1']).toBeUndefined();
    });

    it('should accept convergence edge with name', () => {
      state = createEntity(state, 'e1');
      state = createEntity(state, 'e2');

      state = identityReducer(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-1',
          fromNodeId: 'e1',
          toNodeId: 'e2',
          gives: 'value-prop',
          name: 'Aug 15 2026 Convergence',
          targetDate: '2026-08-15',
        },
      });

      expect(state.lastPlanError).toBeUndefined();
      expect(state.matrix.convergenceEdgesById['conv-1']).toBeDefined();
      expect(state.matrix.convergenceEdgesById['conv-1'].name).toBe('Aug 15 2026 Convergence');
    });
  });

  describe('Step 3.2: Dependency-Chain Exclusion (Hard Block)', () => {
    it('should reject if two sources are sequentially dependent', () => {
      // Create two deliverables with dependency: d1 -> d2
      state = createEntity(state, 'e1');
      state = createInitiative(state, 'i1', 'e1');
      state = createDeliverable(state, 'd1', 'i1');
      state = createDeliverable(state, 'd2', 'i1');
      state = createEntity(state, 'dest');

      console.log('Created deliverables:', Object.keys(state.matrix.deliverablesById || {}));

      // Create dependency: d1 -> d2 (d1 upstream, d2 downstream)
      state = createDependency(state, 'dep-1', 'd1', 'd2');

      console.log('Created dependencies:', Object.keys(state.matrix.dependenciesById || {}));

      // Try to declare convergence with d1 and d2 as sources
      // This should fail because d1 -> d2 is a sequential dependency
      state = identityReducer(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-1',
          fromNodeIds: ['d1', 'd2'],
          toNodeId: 'dest',
          gives: 'value-prop',
          name: 'Aug 15 2026 Convergence',
          targetDate: '2026-08-15',
        },
      });

      expect(state.lastPlanError?.code).toBe('CONVERGENCE_SOURCES_SEQUENTIAL');
      expect(state.lastPlanError?.meta?.violatingPair).toEqual(['d1', 'd2']);
      expect(state.matrix.convergenceEdgesById['conv-1']).toBeUndefined();
    });

    it('should accept if sources are truly parallel (no sequential dependency)', () => {
      // Create two independent deliverables
      state = createEntity(state, 'e1');
      state = createInitiative(state, 'i1', 'e1');
      state = createDeliverable(state, 'd1', 'i1');
      state = createDeliverable(state, 'd2', 'i1');
      state = createEntity(state, 'dest');

      // No dependency between d1 and d2 — they're parallel
      state = identityReducer(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-1',
          fromNodeIds: ['d1', 'd2'],
          toNodeId: 'dest',
          gives: 'value-prop',
          name: 'Aug 15 2026 Convergence',
          targetDate: '2026-08-15',
        },
      });

      expect(state.lastPlanError).toBeUndefined();
      expect(state.matrix.convergenceEdgesById['conv-1']).toBeDefined();
      expect(state.matrix.convergenceEdgesById['conv-1'].fromNodeIds).toEqual(['d1', 'd2']);
    });
  });

  describe('Step 3.3: Deliverable Walkdown', () => {
    it('should discover and store owned deliverables from sources', () => {
      // Create entity -> initiative -> deliverables
      state = createEntity(state, 'e1');
      state = createInitiative(state, 'i1', 'e1');
      state = createDeliverable(state, 'd1', 'i1');
      state = createDeliverable(state, 'd2', 'i1');
      state = createEntity(state, 'dest');

      state = identityReducer(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-1',
          fromNodeId: 'i1',
          toNodeId: 'dest',
          gives: 'value-prop',
          name: 'Aug 15 2026 Convergence',
          targetDate: '2026-08-15',
        },
      });

      expect(state.matrix.convergenceEdgesById['conv-1']).toBeDefined();
      const edge = state.matrix.convergenceEdgesById['conv-1'];

      // Should have discovered both deliverables owned by i1
      expect(edge.sourceDeliverableIds).toContain('d1');
      expect(edge.sourceDeliverableIds).toContain('d2');
    });
  });

  describe('Step 3.4: TargetDate Assignment', () => {
    it('should assign targetDate to discovered deliverables', () => {
      state = createEntity(state, 'e1');
      state = createInitiative(state, 'i1', 'e1');
      state = createDeliverable(state, 'd1', 'i1');
      state = createEntity(state, 'dest');

      const targetDate = '2026-08-15';
      state = identityReducer(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-1',
          fromNodeId: 'i1',
          toNodeId: 'dest',
          gives: 'value-prop',
          name: 'Aug 15 2026 Convergence',
          targetDate,
        },
      });

      // Check that d1 received the convergenceTargetDate
      const deliv = state.matrix.deliverablesById['d1'];
      expect(deliv.convergenceTargetDate).toBe(targetDate);
    });
  });

  describe('Step 3.5: Schema Fields', () => {
    it('should include all new schema fields in convergence edge', () => {
      state = createEntity(state, 'e1');
      state = createEntity(state, 'e2');

      const edgeName = 'Oct 17 2026 Convergence';
      const targetDate = '2026-10-17';

      state = identityReducer(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-1',
          fromNodeId: 'e1',
          toNodeId: 'e2',
          gives: 'value-prop',
          name: edgeName,
          targetDate,
        },
      });

      const edge = state.matrix.convergenceEdgesById['conv-1'];

      // New Step 3 fields
      expect(edge.name).toBe(edgeName);
      expect(edge.targetDate).toBe(targetDate);
      expect(edge.status).toBe('PENDING'); // Initialized as pending
      expect(edge.sourceDeliverableIds).toBeDefined();
      expect(Array.isArray(edge.sourceDeliverableIds)).toBe(true);
      expect(edge.sourceArtifactIds).toBeDefined();
      expect(Array.isArray(edge.sourceArtifactIds)).toBe(true);

      // Step 4 fields (not used in Step 3, but reserved)
      expect(edge.supersedes).toBeNull();
      expect(edge.supersededBy).toBeNull();

      // Legacy fields
      expect(edge.fromNodeId).toBe('e1');
      expect(edge.fromNodeIds).toContain('e1');
      expect(edge.toNodeId).toBe('e2');
      expect(edge.gives).toBe('value-prop');
    });
  });
});

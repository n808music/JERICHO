/**
 * Matrix Schema Completion — Test Suite
 *
 * Validates that all reference schema fields are stored correctly in state.matrix.
 * Tests the 12 schema gaps closure + notes field additions.
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Matrix Schema Completion', () => {
  describe('Notes Field — Shared Addition', () => {
    it('Entity stores notes field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-notes-test',
          name: 'Test Entity',
          purpose: 'Test',
          formationState: 'founded',
          statusEvidence: 'Active',
          notes: 'This is a test note for entity context.',
        },
      });

      const entity = state.matrix.entitiesById['entity-notes-test'];
      expect(entity.notes).toBe('This is a test note for entity context.');
    });

    it('Initiative stores notes field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-notes-test',
          name: 'Test Initiative',
          purpose: 'Test',
          classification: 'objective',
          doneWhen: 'Complete',
          notes: 'Initiative-level operating notes.',
        },
      });

      const initiative = state.matrix.initiativesById['init-notes-test'];
      expect(initiative.notes).toBe('Initiative-level operating notes.');
    });

    it('Deliverable stores notes field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup dependencies
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
        payload: { id: 'i1', name: 'Init', purpose: 'Test', classification: 'objective', doneWhen: 'Complete' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: { id: 'p1', name: 'Proj', owningEntityId: 'e1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliv-notes-test',
          name: 'Test Deliverable',
          owningProjectId: 'p1',
          owningInitiativeId: 'i1',
          notes: 'Work breakdown and constraints.',
        },
      });

      const deliverable = state.matrix.deliverablesById['deliv-notes-test'];
      expect(deliverable.notes).toBe('Work breakdown and constraints.');
    });

    it('System stores notes field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_SYSTEM',
        payload: {
          id: 'sys-notes-test',
          name: 'Test System',
          cycle: 'Q3',
          activationState: 'running',
          notes: 'System operational notes.',
        },
      });

      const system = state.matrix.systemsById['sys-notes-test'];
      expect(system.notes).toBe('System operational notes.');
    });

    it('Convergence stores notes field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup minimal dependencies
      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e-src', name: 'Source', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: { id: 'e-dest', name: 'Dest', purpose: 'Test', formationState: 'founded', statusEvidence: 'Active' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_CONVERGENCE',
        payload: {
          id: 'conv-notes-test',
          fromNodeId: 'e-src',
          toNodeId: 'e-dest',
          gives: 'test',
          name: 'Test Convergence',
          targetDate: '2026-09-15',
          notes: 'Convergence contingency plan.',
        },
      });

      const convergence = state.matrix.convergenceEdgesById['conv-notes-test'];
      expect(convergence.notes).toBe('Convergence contingency plan.');
    });
  });

  describe('Initiative Schema Completion', () => {
    it('Initiative stores Function field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-func-test',
          name: 'Test Initiative',
          purpose: 'For X outcome',
          classification: 'objective',
          doneWhen: 'Complete',
          function: 'Manages cross-entity coordination and resource allocation.',
        },
      });

      const initiative = state.matrix.initiativesById['init-func-test'];
      expect(initiative.function).toBe('Manages cross-entity coordination and resource allocation.');
    });

    it('Initiative stores Next Milestone deadline', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-milestone-test',
          name: 'Test Initiative',
          purpose: 'Test',
          classification: 'objective',
          doneWhen: 'Complete',
          nextMilestoneDeadline: '2026-09-30',
        },
      });

      const initiative = state.matrix.initiativesById['init-milestone-test'];
      expect(initiative.nextMilestoneDeadline).toBe('2026-09-30');
    });

    it('Initiative stores Next Milestone Description', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: 'init-milestone-desc-test',
          name: 'Test Initiative',
          purpose: 'Test',
          classification: 'objective',
          doneWhen: 'Complete',
          nextMilestoneDescription: 'Achieve proof-of-concept with external partner sign-off.',
        },
      });

      const initiative = state.matrix.initiativesById['init-milestone-desc-test'];
      expect(initiative.nextMilestoneDescription).toBe('Achieve proof-of-concept with external partner sign-off.');
    });
  });

  describe('Entity Schema Completion', () => {
    it('Entity stores Description field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_ENTITY',
        payload: {
          id: 'entity-desc-test',
          name: 'Test Corp',
          purpose: 'Test',
          formationState: 'founded',
          statusEvidence: 'Active',
          description: 'A mid-market enterprise focused on vertical market SaaS.',
        },
      });

      const entity = state.matrix.entitiesById['entity-desc-test'];
      expect(entity.description).toBe('A mid-market enterprise focused on vertical market SaaS.');
    });
  });

  describe('Deliverable Schema Completion', () => {
    it('Deliverable stores Work State field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup dependencies
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
        payload: { id: 'i1', name: 'Init', purpose: 'Test', classification: 'objective', doneWhen: 'Complete' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: { id: 'p1', name: 'Proj', owningEntityId: 'e1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliv-workstate-test',
          name: 'Test Deliverable',
          owningProjectId: 'p1',
          owningInitiativeId: 'i1',
          workState: 'planned',
        },
      });

      const deliverable = state.matrix.deliverablesById['deliv-workstate-test'];
      expect(deliverable.workState).toBe('planned');
    });

    it('Deliverable stores Executing Entity field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup dependencies
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
        payload: { id: 'p1', name: 'Proj', owningEntityId: 'e1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliv-exec-test',
          name: 'Test Deliverable',
          owningProjectId: 'p1',
          owningInitiativeId: 'i1',
          executingEntityId: 'e-exec',
        },
      });

      const deliverable = state.matrix.deliverablesById['deliv-exec-test'];
      expect(deliverable.executingEntityId).toBe('e-exec');
    });
  });

  describe('Artifact Schema Completion', () => {
    it('Artifact stores Satisfaction Mode field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup dependencies
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
        payload: { id: 'p1', name: 'Proj', owningEntityId: 'e1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'art-satisfaction-test',
          name: 'Test Artifact',
          producingProjectId: 'p1',
          completionEvidence: 'Artifact exists',
          verificationSourceId: 'vs1',
          operatorAttestationMethod: 'Visual inspection',
          satisfactionMode: 'AND',
        },
      });

      const artifact = state.matrix.artifactsById['art-satisfaction-test'];
      expect(artifact.satisfactionMode).toBe('AND');
    });

    it('Artifact stores Parent Deliverable IDs field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      // Setup dependencies
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
        payload: { id: 'p1', name: 'Proj', owningEntityId: 'e1', successMetric: 'Done', verificationSourceId: 'vs1' },
      });

      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'art-parent-test',
          name: 'Test Artifact',
          producingProjectId: 'p1',
          completionEvidence: 'Artifact exists',
          verificationSourceId: 'vs1',
          operatorAttestationMethod: 'Visual inspection',
          parentDeliverableIds: ['d1', 'd2', 'd3'],
        },
      });

      const artifact = state.matrix.artifactsById['art-parent-test'];
      expect(artifact.parentDeliverableIds).toEqual(['d1', 'd2', 'd3']);
    });
  });

  describe('System Schema Completion', () => {
    it('System stores What it does (mechanism) field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_SYSTEM',
        payload: {
          id: 'sys-mechanism-test',
          name: 'Test System',
          cycle: 'Q3',
          activationState: 'running',
          mechanism: 'Processes incoming leads through CRM pipeline and scores by fit.',
        },
      });

      const system = state.matrix.systemsById['sys-mechanism-test'];
      expect(system.mechanism).toBe('Processes incoming leads through CRM pipeline and scores by fit.');
    });

    it('System stores Feeds / Converges Into field', () => {
      let state = buildBlankIdentityState();
      state.appTime = { nowISO: '2026-08-14T10:00:00Z' };

      state = computeDerivedState(state, {
        type: 'DECLARE_SYSTEM',
        payload: {
          id: 'sys-feeds-test',
          name: 'Test System',
          cycle: 'Q3',
          activationState: 'running',
          feedsInto: 'Sales pipeline, opportunity scoring',
        },
      });

      const system = state.matrix.systemsById['sys-feeds-test'];
      expect(system.feedsInto).toBe('Sales pipeline, opportunity scoring');
    });
  });
});

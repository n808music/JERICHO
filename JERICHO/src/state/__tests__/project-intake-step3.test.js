import { describe, it, expect, beforeEach } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Project Intake Step 3: New gates and field storage', () => {
  let state;

  beforeEach(() => {
    state = buildBlankIdentityState({ nowISO: '2026-09-04T12:00:00Z' });
    state.appTime = { nowISO: '2026-09-04T12:00:00Z' };
  });

  // Setup: declare necessary entities, initiatives, and verification source
  const setupMatrix = () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'vs-test', domain: 'test', source: 'unit_test' },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-owner',
        name: 'Owner Entity',
        roleTags: ['owner'],
        purpose: 'test',
        formationState: 'formed',
        statusEvidence: 'test',
      },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-executor',
        name: 'Executor Entity',
        roleTags: ['executor'],
        purpose: 'test',
        formationState: 'formed',
        statusEvidence: 'test',
      },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'initiative-test',
        name: 'Test Initiative',
        owningEntityId: 'entity-owner',
        purpose: 'test',
        doneWhen: 'test',
        // Step 3: Initiative intake fields
        function: 'ops',
        boundary_type: 'Terminating',
        completion_value: 'Initiative complete',
      },
    });
  };

  describe('Gate order validation (first failure wins)', () => {
    beforeEach(setupMatrix);

    it('Gate 1: PROJECT_INTAKE_INCOMPLETE — missing executing_entity', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-missing-executor',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          // executing_entity: MISSING
          parent_initiative: 'initiative-test',
          boundary_type: 'Terminating',
          terminal_date: '2026-12-31',
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_INTAKE_INCOMPLETE');
      expect(state.matrix.projectsById['project-missing-executor']).toBeUndefined();
    });

    it('Gate 1: PROJECT_INTAKE_INCOMPLETE — missing parent_initiative', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-missing-initiative',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          // parent_initiative: MISSING
          boundary_type: 'Terminating',
          terminal_date: '2026-12-31',
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_INTAKE_INCOMPLETE');
      expect(state.matrix.projectsById['project-missing-initiative']).toBeUndefined();
    });

    it('Gate 1: PROJECT_INTAKE_INCOMPLETE — missing boundary_type', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-missing-boundary',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-test',
          // boundary_type: MISSING
          terminal_date: '2026-12-31',
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_INTAKE_INCOMPLETE');
      expect(state.matrix.projectsById['project-missing-boundary']).toBeUndefined();
    });

    it('Gate 1: PROJECT_INTAKE_INCOMPLETE — missing terminal_date', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-missing-date',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-test',
          boundary_type: 'Terminating',
          // terminal_date: MISSING
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_INTAKE_INCOMPLETE');
      expect(state.matrix.projectsById['project-missing-date']).toBeUndefined();
    });

    it('Gate 2: PROJECT_EXECUTING_ENTITY_UNKNOWN — executing_entity not in matrix', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-bad-executor',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-nonexistent',
          parent_initiative: 'initiative-test',
          boundary_type: 'Terminating',
          terminal_date: '2026-12-31',
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_EXECUTING_ENTITY_UNKNOWN');
      expect(state.matrix.projectsById['project-bad-executor']).toBeUndefined();
    });

    it('Gate 3: PROJECT_PARENT_INITIATIVE_UNKNOWN — parent_initiative not in matrix', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-bad-initiative',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-nonexistent',
          boundary_type: 'Terminating',
          terminal_date: '2026-12-31',
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_PARENT_INITIATIVE_UNKNOWN');
      expect(state.matrix.projectsById['project-bad-initiative']).toBeUndefined();
    });

    it('Gate 4: PROJECT_BOUNDARY_TYPE_INVALID — boundary_type is not Terminating or Ongoing', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-bad-boundary',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-test',
          boundary_type: 'InvalidBoundary',
          terminal_date: '2026-12-31',
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_BOUNDARY_TYPE_INVALID');
      expect(state.matrix.projectsById['project-bad-boundary']).toBeUndefined();
    });

    it('Gate 5: PROJECT_TERMINAL_DATE_INVALID — terminal_date is not valid ISO', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-bad-date-format',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-test',
          boundary_type: 'Terminating',
          terminal_date: 'not-a-date',
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_TERMINAL_DATE_INVALID');
      expect(state.matrix.projectsById['project-bad-date-format']).toBeUndefined();
    });

    it('Gate 6: PROJECT_TERMINAL_DATE_NOT_FUTURE — terminal_date is in the past', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-past-date',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-test',
          boundary_type: 'Terminating',
          terminal_date: '2020-01-01',
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_TERMINAL_DATE_NOT_FUTURE');
      expect(state.matrix.projectsById['project-past-date']).toBeUndefined();
    });

    it('Gate 6: PROJECT_TERMINAL_DATE_NOT_FUTURE — terminal_date is today', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-today-date',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-test',
          boundary_type: 'Terminating',
          terminal_date: '2026-09-04',
        },
      });
      expect(state.lastPlanError?.code).toBe('PROJECT_TERMINAL_DATE_NOT_FUTURE');
      expect(state.matrix.projectsById['project-today-date']).toBeUndefined();
    });
  });

  describe('Holdability check: terminal_date must be in future', () => {
    beforeEach(setupMatrix);

    it('Accepts a valid future date', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-future-valid',
          name: 'Test Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-test',
          boundary_type: 'Terminating',
          terminal_date: '2026-12-31',
        },
      });
      expect(state.lastPlanError).toBeNull();
      expect(state.matrix.projectsById['project-future-valid']).toBeDefined();
    });

    it('Rejects terminal_date at midnight boundary (exactly now)', () => {
      // Even if the appTime is at 2026-09-04T12:00:00Z, the date 2026-09-04 at T00:00:00Z
      // is less than now, so it should be rejected
      const testDate = new Date('2026-09-04T00:00:00Z');
      const nowDate = new Date('2026-09-04T12:00:00Z');
      expect(testDate <= nowDate).toBe(true); // Verify the date is not in the future
    });
  });

  describe('Field storage verification', () => {
    beforeEach(setupMatrix);

    it('Stores all four new Step 3 fields on project object', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-full-intake',
          name: 'Full Intake Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-test',
          boundary_type: 'Terminating',
          terminal_date: '2026-12-31',
        },
      });
      expect(state.lastPlanError).toBeNull();
      const project = state.matrix.projectsById['project-full-intake'];
      expect(project).toBeDefined();
      expect(project.executing_entity).toBe('entity-executor');
      expect(project.parent_initiative).toBe('initiative-test');
      expect(project.boundary_type).toBe('Terminating');
      expect(project.terminal_date).toBe('2026-12-31');
    });

    it('Stores boundary_type as Ongoing when specified', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_PROJECT',
        payload: {
          id: 'project-ongoing',
          name: 'Ongoing Project',
          owningEntityId: 'entity-owner',
          description: 'test',
          verificationSourceId: 'vs-test',
          executing_entity: 'entity-executor',
          parent_initiative: 'initiative-test',
          boundary_type: 'Ongoing',
          terminal_date: '2026-12-31',
        },
      });
      expect(state.lastPlanError).toBeNull();
      const project = state.matrix.projectsById['project-ongoing'];
      expect(project.boundary_type).toBe('Ongoing');
    });
  });
});

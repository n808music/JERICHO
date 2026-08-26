import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';

describe('Barrier detection — legal formation prerequisites', () => {
  it('emits a CONSTRAINT barrier when unformed entity owns a legal-formation-required project', () => {
    let state = buildBlankIdentityState({});

    // Declare an entity that is NOT legally formed
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-startup',
        name: 'TechCorp Startup',
        roleTags: ['business'],
        purpose: 'Building a SaaS platform',
        formationState: 'named-only',
        statusEvidence: 'In formation',
        legallyFormed: false,
      },
    });

    // Declare a project that REQUIRES legal formation
    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-banking-api',
        name: 'Banking API Integration',
        owningEntityId: 'ent-startup',
        description: 'API live in production',
        verificationSourceId: 'vs-banking',
        phase: '1',
        requiresLegalFormation: true,
      },
    });

    // Declare verification source first so project payload is valid
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-banking',
        source: 'Bank Dashboard',
        domain: 'Banking Integrations',
      },
    });

    // Re-apply project declaration now that source exists
    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-banking-api',
        name: 'Banking API Integration',
        owningEntityId: 'ent-startup',
        description: 'API live in production',
        verificationSourceId: 'vs-banking',
        phase: '1',
        requiresLegalFormation: true,
      },
    });

    // Barrier should be detected
    const barriers = Object.values(state.matrix.barriersById || {});
    const legalFormationBarriers = barriers.filter((b) => b.type === 'legalFormation');
    expect(legalFormationBarriers.length).toBe(1);

    const barrier = legalFormationBarriers[0];
    expect(barrier.entityId).toBe('ent-startup');
    expect(barrier.projectId).toBe('proj-banking-api');
    expect(barrier.resolutionType).toBe('prerequisite');
    expect(barrier.claimType).toBe('CONSTRAINT');
    expect(barrier.message).toMatch(/TechCorp Startup.*not legally formed/);
    expect(barrier.message).toMatch(/Banking API Integration.*requires legal formation/);
  });

  it('clears the barrier when entity becomes legally formed', () => {
    let state = buildBlankIdentityState({});

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-formed',
        name: 'Formed Corp',
        roleTags: ['business'],
        purpose: 'An LLC',
        formationState: 'functioning',
        statusEvidence: 'Operating',
        legallyFormed: false, // Initially not formed
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-test',
        source: 'Test Source',
        domain: 'Test Domain',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-test',
        name: 'Test Project',
        owningEntityId: 'ent-formed',
        description: 'Done',
        verificationSourceId: 'vs-test',
        phase: '1',
        requiresLegalFormation: true,
      },
    });

    // Barrier should exist
    let barriers = Object.values(state.matrix.barriersById || {});
    expect(barriers.filter((b) => b.type === 'legalFormation').length).toBe(1);

    // Now mark entity as legally formed
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-formed',
        name: 'Formed Corp',
        roleTags: ['business'],
        purpose: 'An LLC',
        formationState: 'functioning',
        statusEvidence: 'Operating',
        legallyFormed: true, // Now formed
      },
    });

    // Barrier should be cleared
    barriers = Object.values(state.matrix.barriersById || {});
    expect(barriers.filter((b) => b.type === 'legalFormation').length).toBe(0);
  });

  it('does not emit a barrier when entity is legally formed', () => {
    let state = buildBlankIdentityState({});

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-already-formed',
        name: 'Already Formed LLC',
        roleTags: ['business'],
        purpose: 'Established business',
        formationState: 'functioning',
        statusEvidence: 'Operating',
        legallyFormed: true, // Already formed
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-formed',
        source: 'Formation Docs',
        domain: 'Legal Formation',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-formed',
        name: 'Project for Formed Entity',
        owningEntityId: 'ent-already-formed',
        description: 'Complete',
        verificationSourceId: 'vs-formed',
        phase: '2',
        requiresLegalFormation: true,
      },
    });

    // No barrier should be emitted
    const barriers = Object.values(state.matrix.barriersById || {});
    expect(barriers.filter((b) => b.type === 'legalFormation').length).toBe(0);
  });

  it('does not emit a barrier when project does not require legal formation', () => {
    let state = buildBlankIdentityState({});

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-unformed',
        name: 'Unformed Entity',
        roleTags: ['business'],
        purpose: 'Not yet formed',
        formationState: 'named-only',
        statusEvidence: 'Concept stage',
        legallyFormed: false,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-optional',
        source: 'Optional Source',
        domain: 'Optional Domain',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-optional',
        name: 'Optional Formation Project',
        owningEntityId: 'ent-unformed',
        description: 'Plan made',
        verificationSourceId: 'vs-optional',
        phase: '1',
        requiresLegalFormation: false, // Does not require formation
      },
    });

    // No barrier should be emitted
    const barriers = Object.values(state.matrix.barriersById || {});
    expect(barriers.filter((b) => b.type === 'legalFormation').length).toBe(0);
  });

  it('handles entities/projects with missing names gracefully (skips them)', () => {
    let state = buildBlankIdentityState({});

    // Manually create state with incomplete entity (no name)
    state.matrix.entitiesById['ent-incomplete'] = {
      id: 'ent-incomplete',
      name: undefined, // Missing name
      roleTags: [],
      legallyFormed: false,
    };

    state.matrix.projectsById['proj-for-incomplete'] = {
      id: 'proj-for-incomplete',
      name: 'Project Name',
      owningEntityId: 'ent-incomplete',
      requiresLegalFormation: true,
    };

    // Manually trigger barrier computation by calling computeDerivedState
    // with a no-op action to force recomputation
    state = computeDerivedState(state, { type: 'NOOP' });

    // No barrier should be created (entity name is missing)
    const barriers = Object.values(state.matrix.barriersById || {});
    expect(barriers.filter((b) => b.type === 'legalFormation').length).toBe(0);
  });
});

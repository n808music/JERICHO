import { describe, it, expect } from 'vitest';
import { buildLegalFormationAdvisory } from '../legalFormationAdvisory.js';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Legal Formation Advisory', () => {
  it('returns null when no entities exist', () => {
    const state = buildBlankIdentityState();
    const advisory = buildLegalFormationAdvisory(state);
    expect(advisory).toBeNull();
  });

  it('returns null when all entities are in functioning state', () => {
    let state = buildBlankIdentityState();
    // Create a functioning entity
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-functioning',
        name: 'Functioning Corp',
        purpose: 'A company that is already functioning',
        formationState: 'functioning',
        statusEvidence: 'Operating since 2025',
        legallyFormed: true,
      },
    });
    const advisory = buildLegalFormationAdvisory(state);
    expect(advisory).toBeNull();
  });

  it('returns null when non-functioning entity has no work', () => {
    let state = buildBlankIdentityState();
    // Create a non-functioning entity with no projects/work
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-conceptual',
        name: 'Conceptual Startup',
        purpose: 'An idea that is not yet formed',
        formationState: 'conceptual',
        statusEvidence: null,
        legallyFormed: false,
      },
    });
    const advisory = buildLegalFormationAdvisory(state);
    expect(advisory).toBeNull();
  });

  it('surfaces entity with non-functioning state that owns initiatives with projects', () => {
    let state = buildBlankIdentityState();
    // Create a non-functioning entity
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-building',
        name: 'Building Corp',
        purpose: 'A company in development',
        formationState: 'in-development',
        statusEvidence: 'Team assembled, first sprint started',
        legallyFormed: false,
      },
    });
    // Create an initiative owned by that entity
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'init-product',
        name: 'Product Launch',
        owningEntityId: 'ent-building',
        purpose: 'Deliver first product',
        purposeFor: 'Generate initial revenue',
        purposeCompletion: 'MVP launched and users acquired',
        classification: 'objective',
        doneWhen: 'Product is live and first 100 users acquired',
        roleTags: ['project'],
      },
    });
    // Create a project under that initiative
    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'proj-mvp',
        name: 'MVP Development',
        owningInitiativeId: 'init-product',
        purpose: 'Build minimum viable product',
        classification: 'objective',
        doneWhen: 'Code deployed and accessible',
        verificationSourceId: 'vs-default',
      },
    });
    // Create a deliverable under that project
    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliv-backend',
        name: 'Backend API',
        owningProjectId: 'proj-mvp',
        successCriteria: 'API endpoints tested and documented',
        targetDate: '2026-08-31',
      },
    });

    const advisory = buildLegalFormationAdvisory(state);
    expect(advisory).not.toBeNull();
    expect(advisory.title).toBe('Legal Formation Gap');
    expect(advisory.entities).toHaveLength(1);
    expect(advisory.entities[0].name).toBe('Building Corp');
    expect(advisory.entities[0].formationState).toBe('in-development');
    expect(advisory.entities[0].legallyFormed).toBe(false);
  });

  it('does not surface entity if it is in functioning state even with projects', () => {
    let state = buildBlankIdentityState();
    // Create a functioning entity
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-operating',
        name: 'Operating Corp',
        purpose: 'A company that operates',
        formationState: 'functioning',
        statusEvidence: 'Revenue-generating for 2 years',
        legallyFormed: true,
      },
    });
    // Add projects to it anyway
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'init-expansion',
        name: 'Market Expansion',
        owningEntityId: 'ent-operating',
        purpose: 'Expand to new markets',
        purposeFor: 'Grow revenue',
        purposeCompletion: '$1M in new market revenue',
        classification: 'objective',
        doneWhen: 'New market launch complete',
        roleTags: ['project'],
      },
    });

    const advisory = buildLegalFormationAdvisory(state);
    expect(advisory).toBeNull();
  });

  it('handles multiple entities with mixed formation states', () => {
    let state = buildBlankIdentityState();
    // Entity 1: functioning (should NOT appear)
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-1-functioning',
        name: 'Established Corp',
        purpose: 'Already functioning',
        formationState: 'functioning',
        statusEvidence: 'Operating',
        legallyFormed: true,
      },
    });
    // Entity 2: in-development with work (SHOULD appear)
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-2-building',
        name: 'Growing Startup',
        purpose: 'In development',
        formationState: 'in-development',
        statusEvidence: 'Team forming',
        legallyFormed: false,
      },
    });
    // Add initiative to entity 2
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'init-2',
        name: 'First Project',
        owningEntityId: 'ent-2-building',
        purpose: 'Build something',
        purposeFor: 'Test market',
        purposeCompletion: 'Beta release',
        classification: 'objective',
        doneWhen: 'Live with users',
        roleTags: ['project'],
      },
    });
    // Entity 3: conceptual, no work (should NOT appear)
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-3-conceptual',
        name: 'Future Company',
        purpose: 'A future idea',
        formationState: 'conceptual',
        statusEvidence: null,
        legallyFormed: false,
      },
    });

    const advisory = buildLegalFormationAdvisory(state);
    expect(advisory).not.toBeNull();
    expect(advisory.entities).toHaveLength(1);
    expect(advisory.entities[0].name).toBe('Growing Startup');
  });
});

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';

describe('Barrier message format — PROOF', () => {
  it('produces exact locked message format: "BARRIER — {Entity}: not legally formed. {Project} requires legal formation to proceed. This step cannot proceed until resolved."', () => {
    let state = buildBlankIdentityState({});

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'test-entity-1',
        name: 'TechStart Inc',
        roleTags: ['business'],
        purpose: 'Building software',
        formationState: 'named-only',
        statusEvidence: 'In formation',
        legallyFormed: false,
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'test-source-1',
        source: 'Test Source',
        domain: 'Test Domain',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'test-project-1',
        name: 'Banking Integration',
        owningEntityId: 'test-entity-1',
        successMetric: 'API live',
        verificationSourceId: 'test-source-1',
        phase: '1',
        requiresLegalFormation: true,
      },
    });

    // Extract the barrier that was created
    const barriers = Object.values(state.matrix.barriersById || {});
    const barrier = barriers.find((b) => b.type === 'legalFormation');

    expect(barrier).toBeDefined();
    expect(barrier.message).toBeDefined();

    // Verify exact match
    const expectedMessage = 'BARRIER — TechStart Inc: not legally formed. Banking Integration requires legal formation to proceed. This step cannot proceed until resolved.';
    expect(barrier.message).toBe(expectedMessage);
  });
});

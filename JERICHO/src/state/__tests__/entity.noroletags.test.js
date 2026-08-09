import { describe, it, expect, beforeEach } from 'vitest';
import { computeDerivedState } from '../identityCompute';

describe('Entity — zero role-tags validation (Phase 2 critical test)', () => {
  let state;

  beforeEach(() => {
    state = {
      appTime: { nowISO: '2026-08-08T00:00:00Z' },
      today: { date: '2026-08-08' },
      matrix: {
        entitiesById: {},
        initiativesById: {},
        projectsById: {},
        deliverablesById: {},
      },
      activeProfileId: null,
      activeCycleId: null,
    };
  });

  it('should validate Entity successfully with zero/undefined roleTags (regression case)', () => {
    // CRITICAL: Before Phase 2, this test would FAIL because:
    // - declareEntity required roleTags.length > 0 (validation gate)
    // After Phase 2:
    // - The roleTags.length === 0 check is removed from validation
    // - Entity with undefined/empty roleTags should validate successfully

    const entityPayload = {
      id: 'entity-test-1',
      name: 'Test Company Inc.',
      purpose: 'Demonstrate zero role-tags validation',
      formationState: 'in-development',
      statusEvidence: 'Currently operating with team of 5',
      legallyFormed: true,
      // NOTE: roleTags is NOT provided — should be undefined/empty
    };

    // Dispatch the Entity declaration
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: entityPayload,
    });

    // CRITICAL VERIFICATION: Entity should exist in state
    expect(state.matrix.entitiesById['entity-test-1']).toBeDefined();
    const createdEntity = state.matrix.entitiesById['entity-test-1'];

    console.log('\n=== Entity Validation Test: Zero Role-Tags ===');
    console.log(`Entity created: ${createdEntity.id}`);
    console.log(`Entity name: ${createdEntity.name}`);
    console.log(`Entity roleTags field: ${createdEntity.roleTags}`);
    console.log(`Entity purpose: ${createdEntity.purpose}`);
    console.log(`Entity formationState: ${createdEntity.formationState}`);

    // Assertions
    expect(createdEntity.id).toBe('entity-test-1');
    expect(createdEntity.name).toBe('Test Company Inc.');
    expect(createdEntity.purpose).toBe('Demonstrate zero role-tags validation');
    expect(createdEntity.formationState).toBe('in-development');
    expect(createdEntity.statusEvidence).toBe('Currently operating with team of 5');

    // Critical: roleTags field should NOT exist on the Entity node
    // (it was removed during Phase 2)
    expect(createdEntity.roleTags).toBeUndefined();

    console.log(`✓ Entity validation PASSED with zero/undefined roleTags`);
    console.log(`✓ roleTags field is NOT stored on Entity node`);
    console.log(`✓ Entity classification unaffected (id + name + purpose + formationState)\n`);
  });

  it('should validate Entity with all required fields, role-tags optional', () => {
    const entityPayload = {
      id: 'entity-test-2',
      name: 'Global State Systems',
      purpose: 'Strategic infrastructure operations',
      formationState: 'functioning',
      statusEvidence: 'Established in 2020, operating profitably',
      legallyFormed: true,
      namedOnlyConfirmed: false,
      // No roleTags provided
    };

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: entityPayload,
    });

    const entity = state.matrix.entitiesById['entity-test-2'];
    expect(entity).toBeDefined();
    expect(entity.name).toBe('Global State Systems');
    expect(entity.roleTags).toBeUndefined();

    console.log(`\n✓ Entity #2 validation passed (all required fields, no roleTags)`);
  });

  it('should fail validation if name is missing (non-roleTag field still enforced)', () => {
    const entityPayload = {
      id: 'entity-test-3',
      // name is MISSING — this should still fail
      purpose: 'Missing name test',
      formationState: 'named-only',
      namedOnlyConfirmed: true,
      legallyFormed: false,
    };

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: entityPayload,
    });

    // Entity should NOT be created (validation failed)
    expect(state.matrix.entitiesById['entity-test-3']).toBeUndefined();
    expect(state.lastPlanError.code).toBe('ENTITY_INVALID');

    console.log(`\n✓ Entity #3 correctly FAILED validation (missing name)`);
    console.log(`  Error code: ${state.lastPlanError.code}`);
    console.log(`  (Non-roleTag validations still enforced)\n`);
  });
});

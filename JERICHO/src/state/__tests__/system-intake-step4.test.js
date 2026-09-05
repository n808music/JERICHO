import { describe, it, expect, beforeEach } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

/**
 * Step 4, Item 4 — System intake enforcement in the declareSystem reducer.
 *
 * Four intake fields: name, owner, mechanism, feeds_converges_into.
 * Owner resolves to Entity OR the literal 'Cross-cutting' (infrastructure/shared).
 * Mirrors project-intake-step3.test.js and artifact-intake-step3.test.js.
 */
describe('System Intake Step 4: reducer enforcement', () => {
  let state;

  beforeEach(() => {
    state = buildBlankIdentityState({ nowISO: '2026-09-04T12:00:00Z' });
    state.appTime = { nowISO: '2026-09-04T12:00:00Z' };
  });

  const setupMatrix = () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-music',
        name: 'Global State Corporation',
        roleTags: ['owner'],
        purpose: 'test',
        formationState: 'formed',
        statusEvidence: 'test',
      },
    });
  };

  const validSystem = (overrides = {}) => ({
    id: 'system-test',
    name: 'Test System',
    owner: 'Global State Corporation',
    mechanism: 'Step 1 → Step 2 → Step 3 (loop)',
    feeds_converges_into: 'Downstream System A; Downstream System B',
    ...overrides,
  });

  const declare = (overrides) => {
    state = computeDerivedState(state, {
      type: 'DECLARE_SYSTEM',
      payload: validSystem(overrides),
    });
    return state;
  };

  describe('setup sanity', () => {
    beforeEach(setupMatrix);

    it('valid payload lands and is stored', () => {
      declare({});
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.systemsById['system-test']).toBeDefined();
    });
  });

  describe('SYSTEM_NAME_MISSING', () => {
    beforeEach(setupMatrix);

    it('rejects absent name', () => {
      declare({ name: undefined });
      expect(state.lastPlanError?.code).toBe('SYSTEM_NAME_MISSING');
      expect(state.matrix.systemsById['system-test']).toBeUndefined();
    });
  });

  describe('SYSTEM_OWNER_MISSING', () => {
    beforeEach(setupMatrix);

    it('rejects absent owner', () => {
      declare({ owner: undefined });
      expect(state.lastPlanError?.code).toBe('SYSTEM_OWNER_MISSING');
    });

    it('accepts entity name owner', () => {
      declare({ owner: 'Global State Corporation' });
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.systemsById['system-test'].owningEntityId).toBe('entity-music');
    });

    it("accepts 'Cross-cutting' literal (no entity owner)", () => {
      declare({ owner: 'Cross-cutting' });
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.systemsById['system-test'].owningEntityId).toBeNull();
    });

    it('rejects unresolvable entity name', () => {
      declare({ owner: 'Unknown Entity' });
      expect(state.lastPlanError?.code).toBe('SYSTEM_OWNER_UNRESOLVED');
    });
  });

  describe('SYSTEM_MECHANISM_MISSING', () => {
    beforeEach(setupMatrix);

    it('rejects absent mechanism', () => {
      declare({ mechanism: undefined });
      expect(state.lastPlanError?.code).toBe('SYSTEM_MECHANISM_MISSING');
    });

    it('accepts non-empty mechanism', () => {
      declare({ mechanism: 'Acquire → Operate → Harvest' });
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.systemsById['system-test'].mechanism).toBe('Acquire → Operate → Harvest');
    });
  });

  describe('SYSTEM_FEEDS_MISSING', () => {
    beforeEach(setupMatrix);

    it('rejects absent feeds_converges_into', () => {
      declare({ feeds_converges_into: undefined });
      expect(state.lastPlanError?.code).toBe('SYSTEM_FEEDS_MISSING');
    });

    it('accepts feed list', () => {
      declare({ feeds_converges_into: 'System A; System B' });
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.systemsById['system-test'].feeds_converges_into).toBe('System A; System B');
    });
  });

  describe('intake ladder (first failure wins)', () => {
    beforeEach(setupMatrix);

    it('reports NAME_MISSING before OWNER_MISSING', () => {
      declare({ name: undefined, owner: undefined });
      expect(state.lastPlanError?.code).toBe('SYSTEM_NAME_MISSING');
    });

    it('reports OWNER_MISSING before MECHANISM_MISSING', () => {
      declare({ owner: undefined, mechanism: undefined });
      expect(state.lastPlanError?.code).toBe('SYSTEM_OWNER_MISSING');
    });

    it('reports MECHANISM_MISSING before FEEDS_MISSING', () => {
      declare({ mechanism: undefined, feeds_converges_into: undefined });
      expect(state.lastPlanError?.code).toBe('SYSTEM_MECHANISM_MISSING');
    });
  });

  describe('storage', () => {
    beforeEach(setupMatrix);

    it('persists all four intake fields', () => {
      declare({
        name: 'Music System',
        owner: 'Global State Corporation',
        mechanism: 'Compose → Record → Release',
        feeds_converges_into: 'Marketing; Distribution',
      });
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.systemsById['system-test']).toMatchObject({
        name: 'Music System',
        owningEntityId: 'entity-music',
        mechanism: 'Compose → Record → Release',
        feeds_converges_into: 'Marketing; Distribution',
      });
    });

    it('tags the owning entity with [system] role', () => {
      declare({});
      expect(state.matrix.entitiesById['entity-music'].roleTags).toContain('system');
    });

    it('does not create owningEntityId for Cross-cutting owner', () => {
      declare({ owner: 'Cross-cutting' });
      expect(state.matrix.systemsById['system-test'].owningEntityId).toBeNull();
    });
  });
});
